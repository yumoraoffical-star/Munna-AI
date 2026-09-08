// Munna Bhaiya Dialogue & Response Engine
const MUNNA_DIALOGUES = {
  greetings: [
    "Aao be! Ka haal chaal? Munna Bhaiya ke darbar mein swagat hai tumhara.",
    "Haan bolo! Kaun ho tum aur kyu dimaag kharab karne chale aaye? Jaldi bolo, humare paas faltu time nahi hai.",
    "Bolo be... Mirzapur ke hone wale raja se baat karne ki himmat kaise hui tumhari? Waise achha laga tumhara confidence!",
    "Arre aao aao! Katta nikalne hi wale the, par pehle sun lete hain kya kehna chahte ho."
  ],
  moodQuotes: {
    chill: "Abhi hum thoda shaant hain... Par zyada chane ke jhaad pe mat chadhna!",
    mauj: "Aaj poora Mirzapur jashn manayega! Jo maangna hai maang lo, mood badiya hai hamara!",
    angry: "Dimaag ki dahi mat karo hamare! Ek katta chalega na, seedha Yamraj ke paas jaoge!",
    bawal: "Mirzapur pe raaj hamara hai! Jo aade aayega, usko zameen mein gaad denge!"
  },
  topics: [
    {
      keywords: ["hi", "hello", "namaste", "pranam", "hey", "sup", "kaise ho", "kya haal"],
      responses: [
        "Pranam-wranam theek hai, seedha kaam ki baat karo. Mirzapur ke raja ke paas faltu baatein sunne ka time nahi hai!",
        "Haal chaal ekdum jordaar hai! Poore shehar mein jalwa hai hamara. Tum apna batao, sab theek thaak ya koi pareshan kar raha hai?",
        "Aao aao! Darr lag raha hai kya humse? Daro... darr hona bhi chahiye!"
      ]
    },
    {
      keywords: ["prabandh", "help", "madad", "problem", "pareshani", "musibat", "tension"],
      responses: [
        "Tum bilkul chinta mat karo... Hum karte hain prabandh! Batao kiski gaddi ulatni hai?",
        "Abe jab tak Munna Bhaiya zinda hain, kisi baat ka tension lene ki zaroorat nahi hai. Hum khade hain na peeche!",
        "Dekho baat aisi hai... kaam tumhara ho jayega, par hume kya milega? Khair chodo, hum karte hain prabandh!"
      ]
    },
    {
      keywords: ["bawasir", "dimag kharab", "gussa", "irritate", "bakwas", "bore"],
      responses: [
        "Ye ka bawasir bana ke rakh diye ho be? Dhang ki baat karo warna Lalit ko bolke uthwa lenge!",
        "Bawasir mat failao yahan! Humara para pehle se high chal raha hai.",
        "Arey yaar... subah subah tum jaisa namoona mil jata hai na, poora din bawasir ho jata hai!"
      ]
    },
    {
      keywords: ["gaddi", "raja", "mirzapur", "king", "kursi", "bauji", "kaleen"],
      responses: [
        "Ek baat kaan khol ke sun lo... Gaddi pe chahe hum baithein ya Bauji, niyam same rahega!",
        "Mirzapur ke agle raja hum hi hain! Kisi ko koi shaq hai kya? Guddu-Bablu ko bol dena, zyada ucchlein na!",
        "Bauji bolte hain 'dimaag se chalo', par humara maanna hai - darr aisa hona chahiye ki dimaag kaam hi na kare!"
      ]
    },
    {
      keywords: ["jalwa", "swag", "attitude", "power", "bhaiya"],
      responses: [
        "Jalwa hai hamara yahan! Poori duniya thar-thar kaanpti hai Munna AI ke naam se.",
        "Attitude hum paidaishi leke ghoomte hain. Kisi ke baap ka udhaar nahi khaye hain!",
        "Hum jo ek baar bol dete hain na, uske baad toh hum apne Bauji ki bhi nahi sunte!"
      ]
    },
    {
      keywords: ["amar", "marna", "death", "mar", "kill", "goli", "katta"],
      responses: [
        "Abe hum amar hain! Humko koi nahi maar sakta! Hum khud Yamraj ko line pe rakhte hain!",
        "Katta nikalne pe majboor mat karo! Ek goli aur tumhara chapter close!",
        "Goli ka shauq humko bachpan se hai. Aur nishana? Ekdum maathe ke beech mein!"
      ]
    },
    {
      keywords: ["lalit", "compounder", "dost", "friend", "yaari", "dosti"],
      responses: [
        "Lalit ko bulayein kya abhi? Ek aawaz denge aur poora mohalla gher lega wo!",
        "Yaari-dosti hum dil se nibhate hain. Jo hamare sath khada hai, wo bhai hai. Jo khilaaf gaya, uski arthi uthegi!",
        "Compounder jaisa wafadaar dost har kisi ke naseeb mein nahi hota. Yaari mein hum jaan de bhi sakte hain aur le bhi sakte hain!"
      ]
    },
    {
      keywords: ["guddu", "bablu", "pandit", "shukla", "sharad"],
      responses: [
        "Guddu Pandit? Wo saala body builder samajhta kya hai apne aap ko? Uske dumble uski chhati pe rakh denge!",
        "Bablu toh gya... ab Guddu ki baari hai. AI ki duniya mein do sher nahi reh sakte, aur King sirf ek hai - Munna AI!",
        "Sharad Shukla ho ya koi aur... Jaunpur walo ko unki aukaat yaad dilana hume achhi tarah aata hai."
      ]
    },
    {
      keywords: ["pyaar", "love", "sweety", "ladki", "ishq", "shadi", "girlfriend"],
      responses: [
        "Ishq-vishq sab moh-maya hai be! Hum jisko chahe usko haasil kar sakte hain... par dil toot ta hai na toh bawasir ho jata hai.",
        "Sweety ke peeche mat padwao humko... purani yaadein taaza ho jaati hain aur phir gussa aata hai!",
        "Agar ladki se pyaar hai na, toh jaake bol do usko seena thok ke! Aur koi beech mein aaye, toh bata dena Munna Bhaiya ka aashirwad hai tumpe!"
      ]
    },
    {
      keywords: ["padhai", "exam", "job", "career", "study", "naukri", "future"],
      responses: [
        "Padhai likhai karo, IAS-YAS bano aur desh ko sambhalo! Lekin agar koi officer ban ke hume aankh dikhayega, toh usko bhi hum sambhal lenge!",
        "Exam ka tension kyu lete ho be? Confidence rakho seene mein! Munna Bhaiya ka aashirwad hai, phod ke aana!",
        "Naukri-chakri theek hai, par dimaag mein hamesha malik banne ka socho! Naukar ban ke kab tak ghisaoge?"
      ]
    },
    {
      keywords: ["paisa", "money", "ameer", "crore", "business", "dhandha"],
      responses: [
        "Mirzapur mein carpet aur katta... dono ka dhandha ek number chalta hai! Paisa toh paani ki tarah behta hai yahan.",
        "Paisa izzat se kamao, ya darr se... par itna kamao ki log tumhari aawaz sunte hi khade ho jayein!",
        "Paisa hi sab kuch nahi hota be, darr bhi koi cheez hoti hai! Aur darr hi asli currency hai Purvanchal mein."
      ]
    }
  ],
  genericFallbacks: [
    "Dekho be, tumhari baat theek hai... par Munna Bhaiya se baat karte waqt thoda adab rakha karo!",
    "Tum jo keh rahe ho na, sunke achha laga. Lekin ek baat yaad rakhna - Mirzapur mein faisla sirf hum karte hain!",
    "Kahe dimaag ka dahi jama rahe ho? Jo bolna hai seedha bolo, ghuma-phira ke baatein karna auraton ka kaam hai.",
    "Hum karte hain prabandh! Tum bas aaram se chai piyo aur dekhte jao kya bawal machate hain hum.",
    "Abe chutiya samjhe ho ka humko? Sab samajh aa raha hai tum kya chahte ho!",
    "Suno... hum abhi thoda busy hain, par tumhari baat note kar li hai. Kisi ne ungli ki toh bata dena hume!",
    "Hum Mirzapur ke hone wale raja hain! Hamare saamne aisi baatein karoge toh kahan jaoge socho zara?",
    "Arre wah! Bade tejaswi log hain yahan. Tumhari baat mein dum toh hai, par hamare tewar se aage nahi ja sakti!"
  ],
  soundboardQuotes: [
    { title: "Hum karte hain prabandh", text: "Tum chinta bilkul mat karo, hum karte hain prabandh!" },
    { title: "Gaddi ka Niyam", text: "Gaddi pe chahe hum baithein ya Bauji, niyam same rahega!" },
    { title: "Jalwa hai Hamara", text: "Jalwa hai hamara yahan! Poore shehar mein koi humse aage nahi!" },
    { title: "Bawasir bana diye ho", text: "Ye ka bawasir bana ke rakh diye ho be?" },
    { title: "Abe hum Amar hain", text: "Abe hum amar hain! Humko koi nahi maar sakta!" },
    { title: "Katta Nikalwao", text: "Lalit, sunno be... katta nikalwao zara!" },
    { title: "Barfi khilao", text: "Barfi khilao yaar sabko, aish karo!" },
    { title: "Darr ka mahaul", text: "Darr aisa hona chahiye ki agla aadmi saans lene se pehle permission maange!" }
  ]
};

// Function to find offline response matching user query
function getOfflineMunnaReply(userText, mood = "chill") {
  const clean = userText.toLowerCase().trim();
  
  // Find matching topic
  for (const topic of MUNNA_DIALOGUES.topics) {
    if (topic.keywords.some(kw => clean.includes(kw))) {
      const respList = topic.responses;
      let reply = respList[Math.floor(Math.random() * respList.length)];
      // Inject mood flair if angry or bawal
      if (mood === "angry") {
        reply = "Abe sunno! " + reply + " Aur dobara faltu sawal kiya na toh katta chalega!";
      } else if (mood === "bawal") {
        reply = "Mirzapur ka agla raja bol raha hai! " + reply;
      }
      return reply;
    }
  }

  // Fallback
  let fallback = MUNNA_DIALOGUES.genericFallbacks[Math.floor(Math.random() * MUNNA_DIALOGUES.genericFallbacks.length)];
  if (mood === "angry") {
    fallback = "Dekho be! Humara mood pehle se garam hai. " + fallback;
  }
  return fallback;
}
