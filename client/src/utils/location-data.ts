// Romanian administrative divisions data for location dropdowns

export interface County {
  code: string;
  name: string;
  cities: string[];
}

export interface FrenchDepartment {
  code: string;
  name: string;
}

// Official French département codes used by carrier APIs such as MyFlyingBox.
export const frenchDepartments: FrenchDepartment[] = [
  { code: "01", name: "Ain" },
  { code: "02", name: "Aisne" },
  { code: "03", name: "Allier" },
  { code: "04", name: "Alpes-de-Haute-Provence" },
  { code: "05", name: "Hautes-Alpes" },
  { code: "06", name: "Alpes-Maritimes" },
  { code: "07", name: "Ardèche" },
  { code: "08", name: "Ardennes" },
  { code: "09", name: "Ariège" },
  { code: "10", name: "Aube" },
  { code: "11", name: "Aude" },
  { code: "12", name: "Aveyron" },
  { code: "13", name: "Bouches-du-Rhône" },
  { code: "14", name: "Calvados" },
  { code: "15", name: "Cantal" },
  { code: "16", name: "Charente" },
  { code: "17", name: "Charente-Maritime" },
  { code: "18", name: "Cher" },
  { code: "19", name: "Corrèze" },
  { code: "2A", name: "Corse-du-Sud" },
  { code: "2B", name: "Haute-Corse" },
  { code: "21", name: "Côte-d'Or" },
  { code: "22", name: "Côtes-d'Armor" },
  { code: "23", name: "Creuse" },
  { code: "24", name: "Dordogne" },
  { code: "25", name: "Doubs" },
  { code: "26", name: "Drôme" },
  { code: "27", name: "Eure" },
  { code: "28", name: "Eure-et-Loir" },
  { code: "29", name: "Finistère" },
  { code: "30", name: "Gard" },
  { code: "31", name: "Haute-Garonne" },
  { code: "32", name: "Gers" },
  { code: "33", name: "Gironde" },
  { code: "34", name: "Hérault" },
  { code: "35", name: "Ille-et-Vilaine" },
  { code: "36", name: "Indre" },
  { code: "37", name: "Indre-et-Loire" },
  { code: "38", name: "Isère" },
  { code: "39", name: "Jura" },
  { code: "40", name: "Landes" },
  { code: "41", name: "Loir-et-Cher" },
  { code: "42", name: "Loire" },
  { code: "43", name: "Haute-Loire" },
  { code: "44", name: "Loire-Atlantique" },
  { code: "45", name: "Loiret" },
  { code: "46", name: "Lot" },
  { code: "47", name: "Lot-et-Garonne" },
  { code: "48", name: "Lozère" },
  { code: "49", name: "Maine-et-Loire" },
  { code: "50", name: "Manche" },
  { code: "51", name: "Marne" },
  { code: "52", name: "Haute-Marne" },
  { code: "53", name: "Mayenne" },
  { code: "54", name: "Meurthe-et-Moselle" },
  { code: "55", name: "Meuse" },
  { code: "56", name: "Morbihan" },
  { code: "57", name: "Moselle" },
  { code: "58", name: "Nièvre" },
  { code: "59", name: "Nord" },
  { code: "60", name: "Oise" },
  { code: "61", name: "Orne" },
  { code: "62", name: "Pas-de-Calais" },
  { code: "63", name: "Puy-de-Dôme" },
  { code: "64", name: "Pyrénées-Atlantiques" },
  { code: "65", name: "Hautes-Pyrénées" },
  { code: "66", name: "Pyrénées-Orientales" },
  { code: "67", name: "Bas-Rhin" },
  { code: "68", name: "Haut-Rhin" },
  { code: "69", name: "Rhône" },
  { code: "70", name: "Haute-Saône" },
  { code: "71", name: "Saône-et-Loire" },
  { code: "72", name: "Sarthe" },
  { code: "73", name: "Savoie" },
  { code: "74", name: "Haute-Savoie" },
  { code: "75", name: "Paris" },
  { code: "76", name: "Seine-Maritime" },
  { code: "77", name: "Seine-et-Marne" },
  { code: "78", name: "Yvelines" },
  { code: "79", name: "Deux-Sèvres" },
  { code: "80", name: "Somme" },
  { code: "81", name: "Tarn" },
  { code: "82", name: "Tarn-et-Garonne" },
  { code: "83", name: "Var" },
  { code: "84", name: "Vaucluse" },
  { code: "85", name: "Vendée" },
  { code: "86", name: "Vienne" },
  { code: "87", name: "Haute-Vienne" },
  { code: "88", name: "Vosges" },
  { code: "89", name: "Yonne" },
  { code: "90", name: "Territoire de Belfort" },
  { code: "91", name: "Essonne" },
  { code: "92", name: "Hauts-de-Seine" },
  { code: "93", name: "Seine-Saint-Denis" },
  { code: "94", name: "Val-de-Marne" },
  { code: "95", name: "Val-d'Oise" },
  { code: "971", name: "Guadeloupe" },
  { code: "972", name: "Martinique" },
  { code: "973", name: "Guyane" },
  { code: "974", name: "La Réunion" },
  { code: "976", name: "Mayotte" },
];

function normalizeDepartmentSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .trim()
    .replace(/\s+/g, " ");
}

export function searchFrenchDepartments(query: string) {
  const normalizedQuery = normalizeDepartmentSearch(query);
  if (!normalizedQuery) return frenchDepartments;

  return frenchDepartments.filter(({ code, name }) =>
    normalizeDepartmentSearch(`${code} ${name}`).includes(normalizedQuery),
  );
}

// Complete list of Romanian counties (județe) with major cities
export const romanianCounties: County[] = [
  {
    code: "AB",
    name: "Alba",
    cities: ["Alba Iulia", "Aiud", "Blaj", "Câmpeni", "Cugir", "Ocna Mureș", "Sebeș", "Zlatna", "Abrud", "Băbeni", "Băgău", "Berghin", "Bistra", "Blandiana", "Bucerdea Grânoasă", "Bucium", "Câlnic", "Cenade", "Cereza", "Ciugud", "Ciuruleasa", "Cricău", "Cut", "Daia Română", "Doștat", "Fărău", "Galda de Jos", "Gârbova", "Hopârta", "Horea", "Ighiu", "Întregalde", "Jidvei", "Livezile", "Lopadea Nouă", "Lupșa", "Meteș", "Mihalț", "Mirăslău", "Noșlac", "Ohaba", "Pianu", "Ponor", "Poșaga", "Rimetea", "Roșia de Secaș", "Roșia Montană", "Săliștea", "Sălciua", "Sâncel", "Șona", "Șpring", "Șugag", "Teiuș", "Unirea", "Vadu Moților", "Vidra", "Vinița", "Vlăhița"]
  },
  {
    code: "AR", 
    name: "Arad",
    cities: ["Arad", "Chișineu-Criș", "Curtici", "Ineu", "Lipova", "Nădlac", "Pecica", "Sântana"]
  },
  {
    code: "AG",
    name: "Argeș", 
    cities: ["Pitești", "Câmpulung", "Curtea de Argeș", "Mioveni", "Ștefănești", "Costești", "Topoloveni"]
  },
  {
    code: "BC",
    name: "Bacău",
    cities: ["Bacău", "Moinești", "Onești", "Comănești", "Buhuși", "Slănic-Moldova", "Târgu Ocna"]
  },
  {
    code: "BH", 
    name: "Bihor",
    cities: ["Oradea", "Beiuș", "Salonta", "Marghita", "Aleșd", "Valea lui Mihai", "Săcueni", "Nucet", "Ștei", "Vașcău", "Abram", "Aștileu", "Aușeu", "Avram Iancu", "Balc", "Batăr", "Biharia", "Boianu Mare", "Borod", "Borș", "Bratca", "Brusturi", "Budureasa", "Buduslău", "Bulz", "Buntești", "Căbești", "Câmpani", "Căpâlna", "Cărpinet", "Cefa", "Ceica", "Cetariu", "Cherechiu", "Chișlaz", "Ciumeghiu", "Cociuba Mare", "Copăcel", "Criștioru de Jos", "Curățele", "Curtuișeni", "Derna", "Diosig", "Dobrești", "Drăgănești", "Drăgești", "Finiș", "Gepiu", "Girișu de Criș", "Hidișelu de Sus", "Holod", "Husasău de Tinca", "Ineu", "Lăzăreni", "Lazuri de Beiuș", "Lugașu de Jos", "Lunca", "Mădăras", "Măgești", "Nojorid", "Olcea", "Oșorhei", "Paleu", "Petreu", "Pietroasa", "Pocola", "Pomezeu", "Popești", "Răbăgani", "Remetea", "Rieni", "Roșia", "Roșiori", "Sâmbăta", "Sâniob", "Sânnicolau Român", "Sânmartin", "Sântandrei", "Sârbi", "Săcădat", "Sălacea", "Sălard", "Spinuș", "Suplacu de Barcău", "Șimian", "Șinteu", "Șoimi", "Șuncuiuș", "Tămășeu", "Tărcaia", "Tarcea", "Tăuteu", "Tileagd", "Tinca", "Toboliu", "Tulca", "Țețchea", "Uileacu de Beiuș", "Vadu Crișului", "Vârciorog", "Viișoara"]
  },
  {
    code: "BN",
    name: "Bistrița-Năsăud",
    cities: ["Bistrița", "Beclean", "Năsăud", "Sângeorz-Băi", "Bistrița Bârgăului", "Braniștea", "Budacu de Jos", "Budești", "Căianu Mic", "Cetate", "Chiochiș", "Chiuza", "Ciceu-Giurgești", "Ciceu-Mihăiești", "Coșbuc", "Dumitra", "Dumitrița", "Feldru", "Galații Bistriței", "Ilva Mare", "Ilva Mică", "Josenii Bârgăului", "Leșu", "Lechința", "Livezile", "Lunca Ilvei", "Maieru", "Matei", "Măgura Ilvei", "Mărișelu", "Miceștii de Câmpie", "Milaș", "Monor", "Negrilești", "Nimigea", "Nușeni", "Parva", "Petru Rareș", "Poiana Ilvei", "Prundu Bârgăului", "Rebra", "Rebrișoara", "Rodna", "Romuli", "Runcu Salvei", "Salva", "Sânmihaiu de Câmpie", "Șieu", "Șieu-Odorhei", "Șieu-Măgheruș", "Șieuț", "Șintereag"]
  },
  {
    code: "BT",
    name: "Botoșani", 
    cities: ["Botoșani", "Dorohoi", "Darabani", "Săveni", "Flămânzi", "Ștefănești", "Bucecea", "Albești", "Avrămeni", "Băluşeni", "Blândești", "Boscoteni", "Brăești", "Broscăuți", "Budești", "Cândești", "Copalău", "Copălău", "Cordareni", "Coșula", "Cristești", "Cristinești", "Curteşti", "Dărmănești", "Drăgușeni", "Dumeni", "Frumușica", "George Enescu", "Gorban", "Hălăucești", "Havârna", "Hilișeu-Horia", "Hlipiceni", "Hudești", "Ibănești", "Leorda", "Lozna", "Lunca", "Manoleasa", "Mihăileni", "Mihai Eminescu", "Mitoc", "Nicșeni", "Păltinoasa", "Pomîrla", "Prăjești", "Răchiți", "Ripiceni", "Roma", "Românești", "Răuseni", "Santa Mare", "Sendriceni", "Șendriceni", "Suharău", "Ștefănești", "Stăuceni", "Suceava", "Todireni", "Trușești", "Tudora", "Ungureni", "Vârfu Câmpului", "Văculești", "Vorona"]
  },
  {
    code: "BV",
    name: "Brașov",
    cities: ["Brașov", "Făgăraș", "Săcele", "Codlea", "Zărnești", "Râșnov", "Predeal", "Victoria", "Ghimbav", "Augustin", "Beclean", "Bod", "Bran", "Brasov", "Budila", "Bunești", "Căpățânenii Pământeni", "Căpățânenii Ungureni", "Cincu", "Crizbav", "Dăbâca", "Dumbravița", "Feldioara", "Fundata", "Gârcini", "Hălchiu", "Hărman", "Hinog", "Holbav", "Hoghiz", "Homorod", "Hârtibaciu", "Iarăș", "Jibert", "Lisa", "Măieruș", "Mândra", "Mărgineni", "Ormenis", "Părău", "Pătrăuți", "Persani", "Poiana Mărului", "Prejmer", "Purcăreni", "Recea", "Rodbav", "Rotbav", "Rupea", "Sânpetru", "Șercaia", "Șinca", "Șimon", "Teliu", "Tohanu Nou", "Tormac", "Ucea de Jos", "Ucea de Sus", "Ungra", "Vama Buzăului", "Viștea de Jos", "Viștea de Sus", "Voila", "Voronet", "Vulcan"]
  },
  {
    code: "BR",
    name: "Brăila",
    cities: ["Brăila", "Ianca", "Însurăței", "Faurei"]
  },
  {
    code: "B",
    name: "București",
    cities: ["București", "Sector 1", "Sector 2", "Sector 3", "Sector 4", "Sector 5", "Sector 6"]
  },
  {
    code: "BZ",
    name: "Buzău",
    cities: ["Buzău", "Râmnicu Sărat", "Nehoiu", "Pogoanele", "Pătârlagele"]
  },
  {
    code: "CS",
    name: "Caraș-Severin",
    cities: ["Reșița", "Caransebeș", "Lugoj", "Moldova Nouă", "Oțelu Roșu", "Anina", "Băile Herculane"]
  },
  {
    code: "CL",
    name: "Călărași",
    cities: ["Călărași", "Oltenița", "Fundulea", "Lehliu Gară", "Budești"]
  },
  {
    code: "CJ",
    name: "Cluj",
    cities: ["Cluj-Napoca", "Turda", "Dej", "Câmpia Turzii", "Gherla", "Huedin", "Apahida", "Baciu", "Băișoara", "Beliș", "Bobâlna", "Borșa", "Buza", "Călățele", "Căpușu Mare", "Cătina", "Chinteni", "Ciurila", "Cojocna", "Cornești", "Cuzdrioara", "Dăbâca", "Feleacu", "Florești", "Frata", "Fundătura", "Gârbău", "Geaca", "Gilău", "Hasdate", "Iara", "Iclod", "Jichișu de Jos", "Jucu", "Luna", "Luna de Sus", "Măcicașu", "Mărgău", "Mărișelu", "Mihai Viteazu", "Mintiu Gherlii", "Mociu", "Moldovenești", "Negreni", "Palatca", "Panticeu", "Petreștii de Jos", "Ploscoș", "Pomoșten", "Răscruci", "Recea-Cristur", "Rișca", "Sâncraiu", "Sânmărtin", "Sânpaul", "Sălicea", "Săliștea", "Sălișcan", "Savadisla", "Suatu", "Tritenii de Jos", "Tureni", "Unguraș", "Vad", "Valea Ierii", "Valea Florilor", "Viișoara", "Vișea", "Vlaha"]
  },
  {
    code: "CT",
    name: "Constanța",
    cities: ["Constanța", "Mangalia", "Medgidia", "Năvodari", "Cernavodă", "Eforie", "Techirghiol", "Murfatlar", "Ovidiu", "Băneasa", "Cobadin", "Cumpăna", "Adamclisi", "Albeşti", "23 August", "Bărăganu", "Canlia", "Castelu", "Cerchezu", "Chirnogi", "Ciobanu", "Ciocârlia", "Corbu", "Costinești", "Crucea", "Cuza Vodă", "Deleni", "Dorobanțu", "Dunărea", "Ghindarești", "Grădina", "Horia", "Independența", "Ion Corvin", "Istria", "Limanu", "Lipnița", "Lumina", "Mereni", "Mihai Viteazul", "Mihail Kogălniceanu", "Mircea Vodă", "Negru Vodă", "Nicolae Bălcescu", "Oltina", "Ostrov", "Pantelimon", "Peștera", "Poarta Albă", "Rasova", "Saligny", "Săcele", "Seimeni", "Ștefan cel Mare", "Tăgân", "Târgușor", "Topraisar", "Tortoman", "Tuzla", "Vadu", "Valea Dacilor", "Valea Nucarilor", "Vama Veche", "Vânători"]
  },
  {
    code: "CV",
    name: "Covasna",
    cities: ["Sfântu Gheorghe", "Târgu Secuiesc", "Covasna", "Baraolt", "Întorsura Buzăului"]
  },
  {
    code: "DB",
    name: "Dâmbovița",
    cities: ["Târgoviște", "Moreni", "Pucioasa", "Găești", "Fieni", "Titu", "Răzvad"]
  },
  {
    code: "DJ",
    name: "Dolj",
    cities: ["Craiova", "Băilești", "Calafat", "Filiași", "Dăbuleni", "Segarcea"]
  },
  {
    code: "GL",
    name: "Galați",
    cities: ["Galați", "Tecuci", "Târgu Bujor", "Berești"]
  },
  {
    code: "GR",
    name: "Giurgiu",
    cities: ["Giurgiu", "Bolintin-Vale", "Mihăilești"]
  },
  {
    code: "GJ",
    name: "Gorj",
    cities: ["Târgu Jiu", "Motru", "Rovinari", "Novaci", "Țicleni", "Bumbești-Jiu"]
  },
  {
    code: "HR",
    name: "Harghita", 
    cities: ["Miercurea Ciuc", "Odorheiu Secuiesc", "Gheorgheni", "Toplița", "Cristuru Secuiesc", "Bălan"]
  },
  {
    code: "HD",
    name: "Hunedoara",
    cities: ["Deva", "Hunedoara", "Petroșani", "Lupeni", "Vulcan", "Petrila", "Orăștie", "Brad"]
  },
  {
    code: "IL",
    name: "Ialomița",
    cities: ["Slobozia", "Fetești", "Urziceni", "Țăndărei", "Amara"]
  },
  {
    code: "IS",
    name: "Iași",
    cities: ["Iași", "Pașcani", "Hârlău", "Târgu Frumos", "Podu Iloaiei", "Andrieșeni", "Aroneanu", "Bahna", "Bălțați", "Bârnova", "Belcești", "Bivolari", "Boghicea", "Brăești", "Broscăuți", "Bulbucani", "Căiuți", "Ciohorăni", "Ciortești", "Ciurea", "Coarnele Caprei", "Comarna", "Cotnari", "Cozma", "Cristești", "Cucuteni", "Deleni", "Dolhești", "Drăgușeni", "Dumeștii de Jos", "Erbiceni", "Extravere", "Focuri", "Grajduri", "Gropnița", "Guliaie", "Halăucești", "Helesteni", "Holboca", "Hostărie", "Ipatele", "Lespezi", "Letcani", "Lungani", "Mădârjac", "Măgureai", "Mirceștii de Sus", "Miroslava", "Mogosești", "Moldoveni", "Moțca", "Movileni", "Oțeleni", "Plugari", "Popești", "Popricani", "Priești", "Probota", "Răducăneni", "Rediu", "Roșcani", "Sârca", "Săveni", "Scânteia", "Șcheia", "Sinești", "Sirețel", "Știntești", "Stolniceni-Prăjăilă", "Șuletea", "Tibana", "Tomeștii de Sus", "Tomșani", "Trifești", "Țuțora", "Ungheni", "Valea Lupului", "Valea Seacă", "Victoria", "Voineasa", "Voinești"]
  },
  {
    code: "IF",
    name: "Ilfov",
    cities: ["București", "Buftea", "Voluntari", "Pantelimon", "Popești-Leordeni", "Chitila", "Otopeni", "Măgurele"]
  },
  {
    code: "MM",
    name: "Maramureș",
    cities: ["Baia Mare", "Sighetu Marmației", "Borșa", "Vișeu de Sus", "Târgu Lăpuș", "Săliștea de Sus"]
  },
  {
    code: "MH",
    name: "Mehedinți", 
    cities: ["Drobeta-Turnu Severin", "Orșova", "Strehaia", "Vânju Mare"]
  },
  {
    code: "MS",
    name: "Mureș",
    cities: ["Târgu Mureș", "Reghin", "Sighișoara", "Târnăveni", "Luduș", "Iernut"]
  },
  {
    code: "NT",
    name: "Neamț",
    cities: ["Piatra Neamț", "Roman", "Târgu Neamț", "Bicaz", "Roznov"]
  },
  {
    code: "OT",
    name: "Olt",
    cities: ["Slatina", "Caracal", "Balș", "Corabia", "Piatra-Olt", "Drăgănești-Olt"]
  },
  {
    code: "PH",
    name: "Prahova",
    cities: ["Ploiești", "Câmpina", "Băicoi", "Mizil", "Vălenii de Munte", "Sinaia", "Bușteni", "Azuga", "Breaza", "Comarnic", "Plopeni", "Slănic", "Urlați", "Adunatii-Copaceni", "Albești-Paleologu", "Apostolache", "Ariceștii-Rahtivani", "Bărcănești", "Bărcănești", "Berceni", "Bertea", "Boldești-Scăeni", "Brazi", "Bucov", "Cărbunești", "Ceairu", "Cerasu", "Chiojdeanca", "Ciocănești", "Cocorăștii-Colț", "Colceag", "Cornu", "Doftana", "Drăgănești", "Drajna", "Dumbrăvești", "Filipeștii de Pădure", "Filipeștii de Sus", "Florești", "Gherghița", "Gornet-Cricov", "Gorgota", "Gura Vadului", "Gura Vitioarei", "Izvoarele", "Jugureni", "Lapos", "Lipănești", "Măgurele", "Măgureni", "Măneciu", "Mănești", "Olari", "Păcureți", "Păulești", "Pietrărel", "Plopu", "Posești", "Predeal-Sărari", "Provița de Jos", "Provița de Sus", "Puchenii Mari", "Râfov", "Salcia", "Sângeru", "Scorteni", "Șirna", "Șoimarii", "Șotrile", "Starchiojd", "Surani", "Talea", "Tămașani", "Teișani", "Tinosu", "Tomșani", "Tufeni", "Vadu Săpat", "Varbilău", "Vipla"]
  },
  {
    code: "SM",
    name: "Satu Mare",
    cities: ["Satu Mare", "Carei", "Negrești-Oaș", "Tășnad", "Livada", "Ardud"]
  },
  {
    code: "SJ",
    name: "Sălaj",
    cities: ["Zalău", "Șimleu Silvaniei", "Jibou", "Cehu Silvaniei"]
  },
  {
    code: "SB",
    name: "Sibiu",
    cities: ["Sibiu", "Mediaș", "Cisnădie", "Dumbrăveni", "Copșa Mică", "Tălmaciu", "Avrig"]
  },
  {
    code: "SV",
    name: "Suceava",
    cities: ["Suceava", "Botoșani", "Fălticeni", "Rădăuți", "Câmpulung Moldovenesc", "Vatra Dornei", "Gura Humorului"]
  },
  {
    code: "TR",
    name: "Teleorman",
    cities: ["Alexandria", "Rosiori de Vede", "Turnu Măgurele", "Zimnicea", "Videle"]
  },
  {
    code: "TM",
    name: "Timiș",
    cities: ["Timișoara", "Lugoj", "Sânnicolau Mare", "Jimbolia", "Făget", "Deta", "Buziaș", "Ciacova", "Gătaia", "Recaș", "Sânpetru Mare", "Avram Iancu", "Baciu", "Băcești", "Barna", "Becicherecu Mic", "Beled", "Bethausen", "Biertan", "Birda", "Bodzaș", "Bogda", "Boldur", "Brestovăț", "Bucovăț", "Călacea", "Căpălnaș", "Cărpiniș", "Cenad", "Chevereșu Mare", "Comloșu Mare", "Coșava", "Coștei", "Criciova", "Cutina", "Darova", "Dudeștii Noi", "Dudeștii Vechi", "Dumbrăvița", "Fârdea", "Fărășești", "Fibișu", "Foeni", "Gavojdia", "Ghilad", "Ghiroda", "Giarmata", "Giroc", "Giulvăz", "Gottlob", "Jamu Mare", "Jebel", "Lenauheim", "Liebling", "Livezile", "Lovrin", "Mănăștiur", "Margina", "Masliaca", "Moșnița Nouă", "Murani", "Nădrag", "Nitchidorf", "Ohaba Lungă", "Orlat", "Orțișoara", "Parța", "Pătruțești", "Peciu Nou", "Peregu Mare", "Pesac", "Pietroasa", "Pișchiei", "Radna", "Recea", "Remetea Mare", "Roma", "Românești", "Sacoșu Turcesc", "Șag", "Șandra", "Săcălaz", "Sânandrei", "Sânmihaiu Român", "Secaș", "Semlac", "Șoșdea", "Stamora Moravița", "Stiuca", "Șuștra", "Teremia Mare", "Tomeștii Mari", "Topolovățu Mare", "Traian Vuia", "Uivar", "Utvin", "Variaș", "Voiteni", "Voiteg"]
  },
  {
    code: "TL",
    name: "Tulcea",
    cities: ["Tulcea", "Măcin", "Babadag", "Sulina", "Isaccea"]
  },
  {
    code: "VS",
    name: "Vaslui",
    cities: ["Vaslui", "Bârlad", "Huși", "Negrești", "Murgeni"]
  },
  {
    code: "VL",
    name: "Vâlcea",
    cities: ["Râmnicu Vâlcea", "Drăgășani", "Băbeni", "Călimănești", "Horezu", "Brezoi"]
  },
  {
    code: "VN",
    name: "Vrancea",
    cities: ["Focșani", "Adjud", "Panciu", "Mărășești", "Odobești"]
  }
];

// Get cities for a specific county
export const getCitiesForCounty = (countyCode: string): string[] => {
  const county = romanianCounties.find(c => c.code === countyCode);
  return county ? county.cities : [];
};

// Get county name by code
export const getCountyName = (countyCode: string): string => {
  const county = romanianCounties.find(c => c.code === countyCode);
  return county ? county.name : countyCode;
};

// Get all county options for dropdown
export const getCountyOptions = () => {
  return romanianCounties.map(county => ({
    value: county.name,
    label: county.name,
    code: county.code
  }));
};

// International countries list for country dropdown
export const countries = [
  { code: "AD", name: "Andorra" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "AF", name: "Afghanistan" },
  { code: "AG", name: "Antigua and Barbuda" },
  { code: "AI", name: "Anguilla" },
  { code: "AL", name: "Albania" },
  { code: "AM", name: "Armenia" },
  { code: "AO", name: "Angola" },
  { code: "AQ", name: "Antarctica" },
  { code: "AR", name: "Argentina" },
  { code: "AS", name: "American Samoa" },
  { code: "AT", name: "Austria" },
  { code: "AU", name: "Australia" },
  { code: "AW", name: "Aruba" },
  { code: "AX", name: "Åland Islands" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BB", name: "Barbados" },
  { code: "BD", name: "Bangladesh" },
  { code: "BE", name: "Belgium" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BG", name: "Bulgaria" },
  { code: "BH", name: "Bahrain" },
  { code: "BI", name: "Burundi" },
  { code: "BJ", name: "Benin" },
  { code: "BL", name: "Saint Barthélemy" },
  { code: "BM", name: "Bermuda" },
  { code: "BN", name: "Brunei" },
  { code: "BO", name: "Bolivia" },
  { code: "BQ", name: "Caribbean Netherlands" },
  { code: "BR", name: "Brazil" },
  { code: "BS", name: "Bahamas" },
  { code: "BT", name: "Bhutan" },
  { code: "BV", name: "Bouvet Island" },
  { code: "BW", name: "Botswana" },
  { code: "BY", name: "Belarus" },
  { code: "BZ", name: "Belize" },
  { code: "CA", name: "Canada" },
  { code: "CC", name: "Cocos Islands" },
  { code: "CD", name: "Democratic Republic of the Congo" },
  { code: "CF", name: "Central African Republic" },
  { code: "CG", name: "Republic of the Congo" },
  { code: "CH", name: "Switzerland" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "CK", name: "Cook Islands" },
  { code: "CL", name: "Chile" },
  { code: "CM", name: "Cameroon" },
  { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" },
  { code: "CR", name: "Costa Rica" },
  { code: "CU", name: "Cuba" },
  { code: "CV", name: "Cape Verde" },
  { code: "CW", name: "Curaçao" },
  { code: "CX", name: "Christmas Island" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DE", name: "Germany" },
  { code: "DJ", name: "Djibouti" },
  { code: "DK", name: "Denmark" },
  { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominican Republic" },
  { code: "DZ", name: "Algeria" },
  { code: "EC", name: "Ecuador" },
  { code: "EE", name: "Estonia" },
  { code: "EG", name: "Egypt" },
  { code: "EH", name: "Western Sahara" },
  { code: "ER", name: "Eritrea" },
  { code: "ES", name: "Spain" },
  { code: "ET", name: "Ethiopia" },
  { code: "FI", name: "Finland" },
  { code: "FJ", name: "Fiji" },
  { code: "FK", name: "Falkland Islands" },
  { code: "FM", name: "Micronesia" },
  { code: "FO", name: "Faroe Islands" },
  { code: "FR", name: "France" },
  { code: "GA", name: "Gabon" },
  { code: "GB", name: "United Kingdom" },
  { code: "GD", name: "Grenada" },
  { code: "GE", name: "Georgia" },
  { code: "GF", name: "French Guiana" },
  { code: "GG", name: "Guernsey" },
  { code: "GH", name: "Ghana" },
  { code: "GI", name: "Gibraltar" },
  { code: "GL", name: "Greenland" },
  { code: "GM", name: "Gambia" },
  { code: "GN", name: "Guinea" },
  { code: "GP", name: "Guadeloupe" },
  { code: "GQ", name: "Equatorial Guinea" },
  { code: "GR", name: "Greece" },
  { code: "GS", name: "South Georgia and the South Sandwich Islands" },
  { code: "GT", name: "Guatemala" },
  { code: "GU", name: "Guam" },
  { code: "GW", name: "Guinea-Bissau" },
  { code: "GY", name: "Guyana" },
  { code: "HK", name: "Hong Kong" },
  { code: "HM", name: "Heard Island and McDonald Islands" },
  { code: "HN", name: "Honduras" },
  { code: "HR", name: "Croatia" },
  { code: "HT", name: "Haiti" },
  { code: "HU", name: "Hungary" },
  { code: "ID", name: "Indonesia" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IM", name: "Isle of Man" },
  { code: "IN", name: "India" },
  { code: "IO", name: "British Indian Ocean Territory" },
  { code: "IQ", name: "Iraq" },
  { code: "IR", name: "Iran" },
  { code: "IS", name: "Iceland" },
  { code: "IT", name: "Italy" },
  { code: "JE", name: "Jersey" },
  { code: "JM", name: "Jamaica" },
  { code: "JO", name: "Jordan" },
  { code: "JP", name: "Japan" },
  { code: "KE", name: "Kenya" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "KH", name: "Cambodia" },
  { code: "KI", name: "Kiribati" },
  { code: "KM", name: "Comoros" },
  { code: "KN", name: "Saint Kitts and Nevis" },
  { code: "KP", name: "North Korea" },
  { code: "KR", name: "South Korea" },
  { code: "KW", name: "Kuwait" },
  { code: "KY", name: "Cayman Islands" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "LA", name: "Laos" },
  { code: "LB", name: "Lebanon" },
  { code: "LC", name: "Saint Lucia" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LK", name: "Sri Lanka" },
  { code: "LR", name: "Liberia" },
  { code: "LS", name: "Lesotho" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "LV", name: "Latvia" },
  { code: "LY", name: "Libya" },
  { code: "MA", name: "Morocco" },
  { code: "MC", name: "Monaco" },
  { code: "MD", name: "Moldova" },
  { code: "ME", name: "Montenegro" },
  { code: "MF", name: "Saint Martin" },
  { code: "MG", name: "Madagascar" },
  { code: "MH", name: "Marshall Islands" },
  { code: "MK", name: "North Macedonia" },
  { code: "ML", name: "Mali" },
  { code: "MM", name: "Myanmar" },
  { code: "MN", name: "Mongolia" },
  { code: "MO", name: "Macao" },
  { code: "MP", name: "Northern Mariana Islands" },
  { code: "MQ", name: "Martinique" },
  { code: "MR", name: "Mauritania" },
  { code: "MS", name: "Montserrat" },
  { code: "MT", name: "Malta" },
  { code: "MU", name: "Mauritius" },
  { code: "MV", name: "Maldives" },
  { code: "MW", name: "Malawi" },
  { code: "MX", name: "Mexico" },
  { code: "MY", name: "Malaysia" },
  { code: "MZ", name: "Mozambique" },
  { code: "NA", name: "Namibia" },
  { code: "NC", name: "New Caledonia" },
  { code: "NE", name: "Niger" },
  { code: "NF", name: "Norfolk Island" },
  { code: "NG", name: "Nigeria" },
  { code: "NI", name: "Nicaragua" },
  { code: "NL", name: "Netherlands" },
  { code: "NO", name: "Norway" },
  { code: "NP", name: "Nepal" },
  { code: "NR", name: "Nauru" },
  { code: "NU", name: "Niue" },
  { code: "NZ", name: "New Zealand" },
  { code: "OM", name: "Oman" },
  { code: "PA", name: "Panama" },
  { code: "PE", name: "Peru" },
  { code: "PF", name: "French Polynesia" },
  { code: "PG", name: "Papua New Guinea" },
  { code: "PH", name: "Philippines" },
  { code: "PK", name: "Pakistan" },
  { code: "PL", name: "Poland" },
  { code: "PM", name: "Saint Pierre and Miquelon" },
  { code: "PN", name: "Pitcairn" },
  { code: "PR", name: "Puerto Rico" },
  { code: "PS", name: "Palestine" },
  { code: "PT", name: "Portugal" },
  { code: "PW", name: "Palau" },
  { code: "PY", name: "Paraguay" },
  { code: "QA", name: "Qatar" },
  { code: "RE", name: "Réunion" },
  { code: "RO", name: "Romania" },
  { code: "RS", name: "Serbia" },
  { code: "RU", name: "Russia" },
  { code: "RW", name: "Rwanda" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SB", name: "Solomon Islands" },
  { code: "SC", name: "Seychelles" },
  { code: "SD", name: "Sudan" },
  { code: "SE", name: "Sweden" },
  { code: "SG", name: "Singapore" },
  { code: "SH", name: "Saint Helena" },
  { code: "SI", name: "Slovenia" },
  { code: "SJ", name: "Svalbard and Jan Mayen" },
  { code: "SK", name: "Slovakia" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SM", name: "San Marino" },
  { code: "SN", name: "Senegal" },
  { code: "SO", name: "Somalia" },
  { code: "SR", name: "Suriname" },
  { code: "SS", name: "South Sudan" },
  { code: "ST", name: "São Tomé and Príncipe" },
  { code: "SV", name: "El Salvador" },
  { code: "SX", name: "Sint Maarten" },
  { code: "SY", name: "Syria" },
  { code: "SZ", name: "Eswatini" },
  { code: "TC", name: "Turks and Caicos Islands" },
  { code: "TD", name: "Chad" },
  { code: "TF", name: "French Southern Territories" },
  { code: "TG", name: "Togo" },
  { code: "TH", name: "Thailand" },
  { code: "TJ", name: "Tajikistan" },
  { code: "TK", name: "Tokelau" },
  { code: "TL", name: "Timor-Leste" },
  { code: "TM", name: "Turkmenistan" },
  { code: "TN", name: "Tunisia" },
  { code: "TO", name: "Tonga" },
  { code: "TR", name: "Turkey" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "TV", name: "Tuvalu" },
  { code: "TW", name: "Taiwan" },
  { code: "TZ", name: "Tanzania" },
  { code: "UA", name: "Ukraine" },
  { code: "UG", name: "Uganda" },
  { code: "UM", name: "United States Minor Outlying Islands" },
  { code: "US", name: "United States" },
  { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "VA", name: "Vatican City" },
  { code: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "VE", name: "Venezuela" },
  { code: "VG", name: "British Virgin Islands" },
  { code: "VI", name: "U.S. Virgin Islands" },
  { code: "VN", name: "Vietnam" },
  { code: "VU", name: "Vanuatu" },
  { code: "WF", name: "Wallis and Futuna" },
  { code: "WS", name: "Samoa" },
  { code: "YE", name: "Yemen" },
  { code: "YT", name: "Mayotte" },
  { code: "ZA", name: "South Africa" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" }
];

// Get all country options for dropdown
export const getCountryCode = (country: string | undefined): string => {
  if (!country) return "";
  const normalized = country.trim().toLowerCase();
  return countries.find(
    candidate => candidate.code.toLowerCase() === normalized || candidate.name.toLowerCase() === normalized
  )?.code || country;
};

export const getCountryOptions = (useCodes = false) => {
  return countries.map(country => ({
    value: useCodes ? country.code : country.name,
    label: country.name,
    code: country.code
  }));
};