-- ============================================================================
-- SK TRADER v20 - all countries, delivery charge per country, currencies
-- Run once in Supabase > SQL Editor BEFORE uploading v20 (safe to run again).
-- ============================================================================

alter table public.store_settings
  add column if not exists delivery_countries jsonb,
  add column if not exists ship_abroad boolean,
  add column if not exists delivery_abroad_other numeric,
  add column if not exists currencies_enabled boolean,
  add column if not exists currencies jsonb,
  add column if not exists currency_auto boolean,
  add column if not exists currency_markup numeric;

alter table public.orders
  add column if not exists country_iso text default 'PK',
  add column if not exists country text default 'Pakistan';

alter table public.customers
  add column if not exists country_iso text,
  add column if not exists country text;

-- place_order: delivery charge for other countries, no Cash on Delivery abroad
create or replace function public.place_order(p_customer jsonb, p_order jsonb, p_items jsonb)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  cust_id uuid;
  o public.orders;
  it jsonb;
  pr public.products;
  qty int;
  total numeric := 0;
  lines jsonb := '[]'::jsonb;
  online boolean;
  proof text;
  vname text;
  vrow jsonb;
  unit numeric;
  st public.store_settings;
  o_prov text;
  o_city text;
  o_ciso text;
  o_cname text;
  dc numeric := 0;
  g_rate numeric := null;
  g_amt numeric := 0;
  g_incl boolean := true;
  dl public.deals;
  dl_names text;
  di jsonb;
  eff jsonb;
  ditem jsonb;
  chosen text;
  xr record;
  cpr public.products;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;
  if coalesce(trim(p_order ->> 'customer_name'), '') = '' or coalesce(trim(p_order ->> 'customer_phone'), '') = '' then
    raise exception 'Please fill in your name and mobile number.';
  end if;

  -- check every item and work out the total
  for it in select * from jsonb_array_elements(p_items) loop
    qty := (it ->> 'quantity')::int;
    if qty is null or qty < 1 or qty > 1000 then raise exception 'Invalid quantity.'; end if;

    -- a deal: the deal price is charged, the stock of every item inside goes down
    if coalesce(it ->> 'deal_id', '') <> '' then
      select * into dl from public.deals where id = (it ->> 'deal_id')::uuid and is_active;
      if dl.id is null then raise exception 'A deal in your cart is no longer available.'; end if;
      if (dl.starts_at is not null and dl.starts_at > now()) or (dl.ends_at is not null and dl.ends_at <= now()) then
        raise exception 'The deal % has ended. Please remove it from your cart.', dl.name;
      end if;
      if jsonb_array_length(coalesce(dl.items, '[]'::jsonb)) = 0 then raise exception 'The deal % has no items.', dl.name; end if;
      if exists (select 1 from jsonb_array_elements(dl.items) x(e)
                 where not exists (select 1 from public.products p where p.id = (x.e ->> 'product_id')::uuid)) then
        raise exception 'A product of the deal % is no longer available.', dl.name;
      end if;
      -- items where the customer picks the colour / size: take his choice (checked against the product)
      eff := '[]'::jsonb;
      for xr in select x.e, x.ord from jsonb_array_elements(dl.items) with ordinality x(e, ord) loop
        ditem := xr.e;
        if coalesce((xr.e ->> 'choose')::boolean, false) then
          chosen := nullif(trim(coalesce(it -> 'choices' ->> ((xr.ord - 1)::text), '')), '');
          select * into cpr from public.products where id = (xr.e ->> 'product_id')::uuid;
          if chosen is null then
            raise exception 'Please choose the % for % in the deal %.', coalesce(nullif(cpr.variant_label, ''), 'option'), cpr.name, dl.name;
          end if;
          if not exists (select 1 from jsonb_array_elements(coalesce(cpr.variants, '[]'::jsonb)) v(e) where v.e ->> 'name' = chosen) then
            raise exception '% of % is no longer available.', chosen, cpr.name;
          end if;
          ditem := jsonb_set(xr.e - 'choose', '{variant}', to_jsonb(chosen));
        end if;
        eff := eff || jsonb_build_array(ditem);
      end loop;
      select string_agg(case when coalesce((x.e ->> 'qty')::int, 1) > 1 then (x.e ->> 'qty') || ' x ' else '' end
                        || p.name || coalesce(' - ' || nullif(x.e ->> 'variant', ''), ''), ', ' order by x.ord)
        into dl_names
        from jsonb_array_elements(eff) with ordinality x(e, ord)
        join public.products p on p.id = (x.e ->> 'product_id')::uuid;
      lines := lines || jsonb_build_object(
        'product_id', null,
        'product_name', 'DEAL: ' || dl.name || ' (' || coalesce(dl_names, '') || ')',
        'variant', null,
        'quantity', qty,
        'unit_price', dl.deal_price,
        'deal_items', eff
      );
      total := total + dl.deal_price * qty;
      continue;
    end if;

    select * into pr from public.products where id = (it ->> 'product_id')::uuid;
    if pr.id is null then raise exception 'A product in your cart is no longer available.'; end if;

    vname := nullif(trim(coalesce(it ->> 'variant', '')), '');
    if vname is not null then
      vrow := null;
      select x.e into vrow
      from jsonb_array_elements(coalesce(pr.variants, '[]'::jsonb)) as x(e)
      where x.e ->> 'name' = vname
      limit 1;
      if vrow is null then raise exception 'Size % of % is no longer available.', vname, pr.name; end if;
      unit := coalesce(nullif((vrow ->> 'price')::numeric, 0), 0);
    else
      unit := coalesce(nullif(pr.discounted_price, 0), pr.price, 0);
    end if;

    lines := lines || jsonb_build_object(
      'product_id', pr.id,
      'product_name', pr.name || coalesce(' - ' || vname, ''),
      'variant', vname,
      'quantity', qty,
      'unit_price', unit
    );
    total := total + unit * qty;
  end loop;

  -- save / update the customer (matched by phone number)
  begin
    if coalesce(p_customer ->> 'phone', '') <> '' then
      select id into cust_id from public.customers
      where phone_code = p_customer ->> 'phone_code' and phone = p_customer ->> 'phone'
      limit 1;
      if cust_id is null then
        insert into public.customers (name, email, phone_iso, phone_code, phone, country_iso, country,
                                      province_iso, province, city, address, area, zip, marketing_opt_in)
        values (p_customer ->> 'name', nullif(p_customer ->> 'email', ''), p_customer ->> 'phone_iso',
                p_customer ->> 'phone_code', p_customer ->> 'phone', p_customer ->> 'country_iso', p_customer ->> 'country',
                p_customer ->> 'province_iso', p_customer ->> 'province', p_customer ->> 'city', p_customer ->> 'address',
                p_customer ->> 'area', p_customer ->> 'zip',
                coalesce((p_customer ->> 'marketing_opt_in')::boolean, true))
        returning id into cust_id;
      else
        update public.customers set
          name = p_customer ->> 'name',
          email = coalesce(nullif(p_customer ->> 'email', ''), email),
          phone_iso = p_customer ->> 'phone_iso',
          country_iso = p_customer ->> 'country_iso', country = p_customer ->> 'country',
          province_iso = p_customer ->> 'province_iso', province = p_customer ->> 'province',
          city = p_customer ->> 'city', address = p_customer ->> 'address',
          area = coalesce(p_customer ->> 'area', area), zip = coalesce(p_customer ->> 'zip', zip),
          marketing_opt_in = coalesce((p_customer ->> 'marketing_opt_in')::boolean, marketing_opt_in)
        where id = cust_id;
      end if;
    end if;
  exception when others then
    cust_id := null;  -- a customer-record problem must not block the order
  end;

  -- Delivery charge: Karachi city has its own charge, other cities use their province's charge
  o_prov := nullif(trim(coalesce(p_order ->> 'province', p_customer ->> 'province', '')), '');
  o_city := nullif(trim(coalesce(p_order ->> 'city', p_customer ->> 'city', '')), '');
  if o_city is null then raise exception 'Please select your city.'; end if;
  select * into st from public.store_settings where id = 1;
  -- Country: Pakistan unless the customer chose another country
  o_ciso := upper(left(coalesce(nullif(trim(coalesce(p_order ->> 'country_iso', p_customer ->> 'country_iso', '')), ''), 'PK'), 2));
  o_cname := left(coalesce(nullif(trim(coalesce(p_order ->> 'country', p_customer ->> 'country', '')), ''), case when o_ciso = 'PK' then 'Pakistan' else o_ciso end), 80);
  if o_ciso <> 'PK' then
    -- Delivery abroad: the country's own charge (Admin > Delivery Charges), else the charge for other countries
    if st.delivery_countries is not null and st.delivery_countries ? o_ciso
       and (st.delivery_countries ->> o_ciso) ~ '^[0-9]+(\.[0-9]+)?$' then
      dc := (st.delivery_countries ->> o_ciso)::numeric;
    elsif coalesce(st.ship_abroad, false) then
      dc := coalesce(st.delivery_abroad_other, 0);
    else
      raise exception 'Sorry, we do not deliver to % yet.', o_cname;
    end if;
    if coalesce(nullif(p_order ->> 'payment_method', ''), 'cod') = 'cod' then
      raise exception 'Cash on Delivery is only inside Pakistan. Please choose Online Payment.';
    end if;
  elsif coalesce(st.free_delivery_over, 0) > 0 and total >= st.free_delivery_over then
    dc := 0;
  elsif lower(o_city) = 'karachi' then
    dc := coalesce(st.delivery_karachi, 0);
  elsif st.delivery_rates is not null and st.delivery_rates ? coalesce(o_prov, '')
        and (st.delivery_rates ->> o_prov) ~ '^[0-9]+(\.[0-9]+)?$' then
    dc := (st.delivery_rates ->> o_prov)::numeric;
  else
    dc := coalesce(st.delivery_other, 250);
  end if;

  -- Sales tax (GST) on the goods, as set in Admin > Invoice & Tax
  if coalesce(st.gst_enabled, false) and coalesce(st.gst_rate, 0) > 0 then
    g_rate := st.gst_rate;
    g_incl := coalesce(st.gst_inclusive, true);
    g_amt := case when g_incl then round(total * g_rate / (100 + g_rate), 2)
                  else round(total * g_rate / 100, 2) end;
  end if;

  online := coalesce(nullif(p_order ->> 'payment_method', ''), 'cod') <> 'cod';
  if not online and o_ciso = 'PK' and coalesce(st.cod_karachi_only, true) and lower(o_city) <> 'karachi' then
    raise exception 'Cash on Delivery is only for Karachi. Please choose Online Payment.';
  end if;
  proof := case when online and left(coalesce(p_order ->> 'payment_proof', ''), 11) = 'data:image/'
                     and length(p_order ->> 'payment_proof') < 3000000
                then p_order ->> 'payment_proof' end;

  insert into public.orders (invoice_no, customer_id, customer_name, customer_phone, customer_email, shipping_address,
                             total_amount, payment_method, payment_status, paid_amount, transaction_id, status,
                             payment_account_id, payment_account_label, payer_name, payer_account, payer_amount,
                             payer_paid_at, has_payment_proof, customer_user_id,
                             subtotal, delivery_charge, province, city, area, zip, gst_rate, gst_amount, gst_inclusive,
                             country_iso, country)
  values (upper(coalesce(nullif(trim(st.invoice_prefix), ''), 'SK')) || '-' || to_char(now() at time zone 'Asia/Karachi', 'YYMMDD')
            || '-' || nextval('public.invoice_seq'),
          cust_id, trim(p_order ->> 'customer_name'), p_order ->> 'customer_phone',
          nullif(trim(coalesce(p_order ->> 'customer_email', '')), ''), p_order ->> 'shipping_address',
          total + dc + case when g_incl then 0 else g_amt end, left(coalesce(nullif(p_order ->> 'payment_method', ''), 'cod'), 40), 'Unpaid', 0,
          case when online then left(nullif(trim(coalesce(p_order ->> 'transaction_id', '')), ''), 80) end,
          'Pending',
          case when online then left(p_order ->> 'payment_account_id', 80) end,
          case when online then left(p_order ->> 'payment_account_label', 200) end,
          case when online then left(nullif(trim(coalesce(p_order ->> 'payer_name', '')), ''), 120) end,
          case when online then left(nullif(trim(coalesce(p_order ->> 'payer_account', '')), ''), 60) end,
          case when online and coalesce(p_order ->> 'payer_amount', '') ~ '^[0-9]+(\.[0-9]+)?$'
               then (p_order ->> 'payer_amount')::numeric end,
          case when online and coalesce(p_order ->> 'payer_paid_at', '') <> ''
               then (p_order ->> 'payer_paid_at')::timestamptz end,
          proof is not null, auth.uid(),
          total, dc, o_prov, o_city, left(nullif(trim(coalesce(p_order ->> 'area', '')), ''), 120),
          left(nullif(trim(coalesce(p_order ->> 'zip', '')), ''), 10),
          g_rate, g_amt, g_incl, o_ciso, o_cname)
  returning * into o;

  if proof is not null then
    insert into public.payment_proofs (order_id, image) values (o.id, proof);
  end if;

  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, variant, deal_items)
  select o.id, (l ->> 'product_id')::uuid, l ->> 'product_name', (l ->> 'quantity')::int, (l ->> 'unit_price')::numeric, l ->> 'variant',
         case when jsonb_typeof(l -> 'deal_items') = 'array' then l -> 'deal_items' end
  from jsonb_array_elements(lines) l;

  for it in select * from jsonb_array_elements(lines) loop
    if jsonb_typeof(it -> 'deal_items') = 'array' then
      for di in select * from jsonb_array_elements(it -> 'deal_items') loop
        if coalesce(di ->> 'variant', '') <> '' then
          perform public.decrement_variant_stock((di ->> 'product_id')::uuid, di ->> 'variant', (it ->> 'quantity')::int * coalesce((di ->> 'qty')::int, 1));
        else
          perform public.decrement_stock((di ->> 'product_id')::uuid, (it ->> 'quantity')::int * coalesce((di ->> 'qty')::int, 1));
        end if;
      end loop;
    elsif coalesce(it ->> 'variant', '') <> '' then
      perform public.decrement_variant_stock((it ->> 'product_id')::uuid, it ->> 'variant', (it ->> 'quantity')::int);
    else
      perform public.decrement_stock((it ->> 'product_id')::uuid, (it ->> 'quantity')::int);
    end if;
  end loop;

  return json_build_object('order', to_jsonb(o), 'items', lines);
end $$;


notify pgrst, 'reload schema';
