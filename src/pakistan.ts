// Pakistan delivery addresses: Province -> City -> Area.
// zip = the city's main postal code (filled in for the customer, who can change it).
// A city without an area list (or a missing area) uses "Other area" and the customer types it.
// To add an area or a city, add it to the lists below.

type City = { zip: string; areas: string[] };

const c = (zip: string, areas = ''): City => ({ zip, areas: areas ? areas.split('|') : [] });

export const PAKISTAN: Record<string, Record<string, City>> = {
  Sindh: {
    Karachi: c('74000', 'Abul Hassan Isphani Road|Aisha Manzil|Ancholi|Azizabad|Baldia Town|Bahadurabad|Bahria Town Karachi|Bath Island|Bin Qasim|Boat Basin|Buffer Zone|Burns Road|Cantt|Chanesar Goth|Civil Lines|Clifton|Defence (DHA)|DHA City|Dhoraji|F.B. Area|Federal B Area|Garden|Gizri|Gulberg|Gulistan-e-Jauhar|Gulshan-e-Iqbal|Gulshan-e-Maymar|Gulzar-e-Hijri|Hyderi|Ibrahim Hyderi|Jamshed Road|Kemari|Khadda Market|Kharadar|Korangi|Landhi|Liaquatabad|Lyari|Malir|Malir Cantt|Manzoor Colony|Mehmoodabad|Model Colony|Nazimabad|New Karachi|North Karachi|North Nazimabad|Old City Area|Orangi Town|P.E.C.H.S.|Qayyumabad|Saddar|Safoora|Scheme 33|Shah Faisal Colony|Shahra-e-Faisal|SITE Area|Soldier Bazaar|Surjani Town|Tariq Road|Tipu Sultan Road|University Road|Water Pump'),
    Hyderabad: c('71000', 'Auto Bhan Road|Citizen Colony|Gulistan-e-Sajjad|Hirabad|Hussainabad|Latifabad|Qasimabad|Saddar|Sindh University Colony|Wahdat Colony'),
    Sukkur: c('65200', 'Barrage Colony|Military Road|Minara Road|New Sukkur|Old Sukkur|Workshop Road'),
    Larkana: c('77150', 'Bakrani Road|Lahori Mohalla|Sachal Colony|Station Road|VIP Road'),
    Nawabshah: c('67450', 'Housing Society|Masjid Road|Station Road'),
    Mirpurkhas: c('69000', 'Satellite Town|Station Road|Umerkot Road'),
    Jacobabad: c('79000'),
    Shikarpur: c('78100'),
    Khairpur: c('66020'),
    Thatta: c('73130'),
    Badin: c('72200'),
    Dadu: c('76200'),
    Sanghar: c('68100'),
    'Tando Adam': c('68050'),
    'Tando Allahyar': c('70050'),
    Ghotki: c('65110'),
    Umerkot: c('69100'),
    Jamshoro: c('76090'),
    Kotri: c('76100')
  },
  Punjab: {
    Lahore: c('54000', 'Allama Iqbal Town|Anarkali|Askari|Bahria Town Lahore|Cantt|Cavalry Ground|Defence (DHA)|Faisal Town|Garden Town|Gulberg|Gulshan-e-Ravi|Ichhra|Johar Town|Model Town|Mughalpura|Muslim Town|Samanabad|Shadman|Shahdara|Shalimar|Township|Valencia|Walled City|Wapda Town|Wahdat Road'),
    Faisalabad: c('38000', 'D Ground|Ghulam Muhammadabad|Jinnah Colony|Kohinoor City|Madina Town|Millat Town|Peoples Colony|Samanabad|Satiana Road|Susan Road'),
    Rawalpindi: c('46000', 'Adiala Road|Bahria Town|Chaklala|Committee Chowk|Dhok Kala Khan|Gulraiz|Saddar|Satellite Town|Scheme 3|Westridge'),
    Gujranwala: c('52250', 'Citi Housing|DC Road|Model Town|Peoples Colony|Satellite Town|Wapda Town'),
    Multan: c('60000', 'Bosan Road|Cantt|Gulgasht Colony|Mumtazabad|New Multan|Shah Rukn-e-Alam Colony|Wapda Town'),
    Sialkot: c('51310', 'Cantt|Defence Road|Kashmir Road|Model Town|Paris Road'),
    Bahawalpur: c('63100', 'Cantt|Model Town|Satellite Town|Shahdrah'),
    Sargodha: c('40100', 'Satellite Town|University Road|Cantt'),
    Sheikhupura: c('39350'),
    'Rahim Yar Khan': c('64200'),
    Jhang: c('35200'),
    'Dera Ghazi Khan': c('32200'),
    Gujrat: c('50700'),
    Sahiwal: c('57000'),
    Wah: c('47040'),
    Kasur: c('55050'),
    Okara: c('56300'),
    Chiniot: c('35400'),
    Kamoke: c('52470'),
    Sadiqabad: c('64350'),
    Burewala: c('61010'),
    Jhelum: c('49600'),
    Khanewal: c('58150'),
    Hafizabad: c('52110'),
    'Muzaffargarh': c('34200'),
    Khanpur: c('64100'),
    Attock: c('43600'),
    Mianwali: c('42200'),
    Chakwal: c('48800'),
    Vehari: c('61100'),
    Narowal: c('51600'),
    'Mandi Bahauddin': c('50400'),
    Pakpattan: c('57400'),
    Bahawalnagar: c('62300'),
    Lodhran: c('59320'),
    Layyah: c('31200'),
    Bhakkar: c('30000'),
    'Toba Tek Singh': c('36050'),
    Murree: c('47150')
  },
  'Khyber Pakhtunkhwa': {
    Peshawar: c('25000', 'Board Bazaar|Cantt|Gulbahar|Hayatabad|Saddar|University Town|Warsak Road|Dalazak Road'),
    Mardan: c('23200'),
    Abbottabad: c('22010', 'Cantt|Jinnah Abad|Mandian|Supply'),
    Swat: c('19200'),
    Mingora: c('19130'),
    Kohat: c('26000'),
    'Dera Ismail Khan': c('29050'),
    Nowshera: c('24100'),
    Charsadda: c('24420'),
    Mansehra: c('21300'),
    Bannu: c('28100'),
    Haripur: c('22620'),
    Swabi: c('23430'),
    Chitral: c('17200')
  },
  Balochistan: {
    Quetta: c('87300', 'Brewery Road|Cantt|Jinnah Town|Samungli Road|Satellite Town|Zarghoon Road'),
    Gwadar: c('91200'),
    Turbat: c('92600'),
    Khuzdar: c('89100'),
    Hub: c('90250'),
    Sibi: c('82000'),
    Chaman: c('86000'),
    Zhob: c('85200'),
    Loralai: c('84800')
  },
  'Islamabad Capital Territory': {
    Islamabad: c('44000', 'Bahria Town|Bani Gala|Blue Area|DHA Islamabad|E-7|E-11|F-6|F-7|F-8|F-10|F-11|G-6|G-7|G-8|G-9|G-10|G-11|G-13|G-14|H-8|H-13|I-8|I-9|I-10|I-14|Gulberg Greens|PWD|Soan Gardens|Tarnol')
  },
  'Gilgit-Baltistan': {
    Gilgit: c('15100'),
    Skardu: c('16100'),
    Hunza: c('15700')
  },
  'Azad Jammu & Kashmir': {
    Muzaffarabad: c('13100'),
    Mirpur: c('10250'),
    Kotli: c('11100'),
    Bhimber: c('10040'),
    Rawalakot: c('12350')
  }
};

export const PROVINCES = Object.keys(PAKISTAN);

export const citiesOf = (province: string) => Object.keys(PAKISTAN[province] || {}).sort();

export const areasOf = (province: string, city: string) =>
  ((PAKISTAN[province] && PAKISTAN[province][city]) || { areas: [] as string[] }).areas.slice().sort();

export const zipOf = (province: string, city: string) =>
  ((PAKISTAN[province] && PAKISTAN[province][city]) || { zip: '' }).zip;

// Pakistani mobile: 10 digits starting with 3 (shown after a fixed +92)
export const mobileDigits = (v: string) => {
  let d = (v || '').replace(/\D/g, '');
  if (d.startsWith('92')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
};
export const isValidMobile = (v: string) => /^3\d{9}$/.test(mobileDigits(v));

export interface PkAddress {
  province: string;
  city: string;
  area: string;     // chosen from the list, or typed when "Other area" is chosen
  address: string;  // house / shop / street
  zip: string;
  mobile: string;   // 10 digits after +92
}

export const emptyPkAddress = (): PkAddress => ({ province: '', city: '', area: '', address: '', zip: '', mobile: '' });

// Returns a message for the first missing / wrong field, or '' when everything is fine.
export function checkPkAddress(a: PkAddress): string {
  if (!isValidMobile(a.mobile)) return 'Please enter a valid mobile number: +92 3XX XXXXXXX.';
  if (!a.province) return 'Please select your province.';
  if (!a.city) return 'Please select your city.';
  if (!a.area.trim()) return 'Please select or type your area.';
  if (!a.address.trim()) return 'Please enter your house / shop and street address.';
  if (!/^\d{5}$/.test(a.zip.trim())) return 'Please enter a 5-digit postal (ZIP) code.';
  return '';
}

export const fullPkAddress = (a: PkAddress) =>
  [a.address.trim(), a.area.trim(), a.city, a.province, 'Pakistan', a.zip ? `Postal Code: ${a.zip.trim()}` : ''].filter(Boolean).join(', ');

// All city names (for admin filters) and a helper that finds the city in an older address text
export const ALL_CITIES = Object.values(PAKISTAN).flatMap(p => Object.keys(p)).sort();
export function cityFromText(text: string): string {
  const t = (text || '').toLowerCase();
  let best = '';
  for (const ct of ALL_CITIES) if (t.includes(ct.toLowerCase()) && ct.length > best.length) best = ct;
  return best;
}
