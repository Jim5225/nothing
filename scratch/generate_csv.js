const fs = require('fs');

const data = `Name,Address,Phone,Website
"Food Cloud","Nayapara Rd, Mymensingh","01701-007163",""
"Urban Bistro Restaurant","179 Charpara Rd, Mymensingh","01810-105395",""
"Bubu's Kitchen 3","noyapara, Charpara Rd, Mymensingh 2200","01312-342942",""
"বিফ মেজবানী হোটেল","312 Charpara Rd, Mymensingh","01346-633428",""
"Star Cuisine Restaurant","11 CK Ghosh Rd, Mymensingh 2200","01328-959302","https://www.facebook.com/starcuisineofficial"
"PanchTara Restaurant, Charpara","PCW5+5G7 Charpara Tower, 255, Plot : 256, Pacth Tara Bhabon, Beside Of Chorpara Mor Charpara Road, Dhaka-Mymensingh Rd, Mymensingh 2200","01977-486887",""
"তাঁরা হোটেল","Mosjid Building, Beside Baitul Mouazzom Jame Mosque Dhaka - Mymensingh Road,1 No Hospital Gate, Charpara Rd, Mymensingh 2200","01938-024541",""
"Lobongo Restaurant","PCR5+J2G, Charpara Rd, Mymensingh 2200","01932-678012",""
"Noor's Dine Restaurant","PCX5+33Q Chamra Gudam, Dhaka Mymensing Road, Near By Nova Diagnostic Centre, Charpara Rd, Mymensingh","01833-062713",""
"দি নিউ পাঁচতারা বেকারী এন্ড রেষ্টুরেন্ট","Shop No.260, New Patch Tara Restaurant Bhabon Beside Of Chorpara Mor, Dhaka - Mymensingh Road, Charpara Rd, Mymensingh 2200","01970-230989",""
"Spicy bites","PCR4+QXF, Medical College By Ln, Mymensingh","01970-036501",""
"ঘরোয়া রেস্টুরেন্ট","253, Primary School Road, Charpara Rd, Chorpara 2200","01738-232964",""
"Hotel Al Rifat, Mymensingh","Plot : 319, Hotel Al - Rifat Bhabon, Chorpara Road Chorpara, 2200","01713-523033",""
"Takuwa Restaurant & Cafe","PCR5+W4C, Mymensingh 2200","01731-868773",""
"Takwa Restaurant and Chap Ghar","68 Baghmara road, Charpara Rd, Mymensingh 2200","01713-605045",""
"Kacchi Dine - Mymensingh","Charpara Rd, Mymensingh","01810-190879","http://www.kacchidine.com/"
"মা রেস্টুরেন্ট","PCW5+4G6, Pacth Tara Bhabon, Beside Of Chorpara Mor, Dhaka-Mymensingh Rd, 2200","01758-222142",""
"Sorgoram Restaurant, Mymensingh","Charpara Rd, Mymensingh 2200","01834-535135",""
"নিরামিষ ভোজনালয় Niramish Hotel","PCW5+326, Mymensingh 2200","01718-418929",""
"Hotel Appayon","Plot 216, Beside Baitul Mouazzom Jame Mosque Dhaka - Mymensingh Road, 1 No Hospital Gate, Mymensingh 2200","01709-610602",""
"PizzaBurg Mymensingh","1st floor, 44 Ram Babu Rd, Mymensingh 2200","01404-461207",""
"Salam Hotel","PCW5+366, Beside Chorpara Mor, Chorpara Primary School Road, Hospital Gate, Charpara Rd, Mymensingh 2200","01939-823761",""
"Sagar","26/1 Medical College By Ln, Mymensingh","01711-957557",""
"Sarinda Restaurant","2nd floor 11s, 88 CK Ghosh Rd, Mymensingh 2200","01712-121434","http://m.facebook.com/sarindabd"
"Hungry Treat","68/B, 1 Baghmara Rd, Mymensingh 2200","01759-162748",""
"তারার মেলা রেস্তোরা","Hamid Market, Near At Charpara Mor (Circle Dhaka-Mymensingh Road, Bridge Mor Sadar, Charpara, Mymensingh 2200","01819-865502",""
"হোটেল চাঁদনী","Mymensingh","01970-189748",""
"Tajmohol Restaurant","QC36+V7X, Mymensingh","01407-980670",""
"LUMINOUS Cafe & Restaurant","Mymensingh City Bypass, Mymensingh","01780-367675",""
"হোটেল আল ইমরান","P9VW+7PV, Akua Morolpara Rd, Mymensingh","01923-717959",""
"Hawa Restaurant & Party Centre","Dhaka Bypass Mor, Mymensingh 2200","01705-036161","https://www.facebook.com/share/1A5bom5k9N/"
"Chef Time Restaurant","Near Mymensingh Polytechnic Institute, Maskanda Road Mymensingh, 2202","01734-940927",""
"New Bismillah Hotel","Beside Baitul Mouazzom Jame Mosque, Dhaka - Mymensingh Road 1 No Hospital Gate, Charpara, Mymensingh 2200","01754-870340",""
"Barbie Cafe","Notun bazar mofiz uddin index plaza shop no 312,313,329, Mymensingh","01912-945132",""
"Safwan restorent","৬৮, ৩ Baghmara Rd, Mymensingh","",""
"Hotel Kawser","PCR5+R4R, Medical Rd, Mymensingh","01988-568632",""
"Kacchi Bhai - Mymensingh","44 Ram Babu Rd, Mymensingh 2200","01329-702993","http://kacchibhai.com/"
"Ayesh Restaurant","PCP5+H33 Bus Stand, Amirabad, Charpara Rd, Mymensingh 2200","01330-400126","https://famicart.com/"
"Big Burger & Igloo Selecta Ice Cream Parlour","77/G, 2, 1 Charpara Rd, Mymensingh 2200","01717-628989",""
"Zaytoon Restaurant Mymensingh","moddo barera S.m service and petrol pump, Akua bypass, Mymensingh 2200","01787-999131",""`;

const lines = data.split('\n');
const header = lines[0] + ',"Email"';
const result = [header];

let emailIndex = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  let email = '';
  if (i === 1) {
    email = "jimjaaj@gmail.com";
  } else if (i === 2) {
    email = "jimjayedalafroz@gmail.com";
  } else {
    // extract name
    const match = line.match(/^"([^"]+)"/);
    let name = match ? match[1] : "restaurant";
    name = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    email = \`\${name}\${i}@dummy.com\`;
  }
  
  result.push(\`\${line},"\${email}"\`);
}

console.log(result.join('\\n'));
