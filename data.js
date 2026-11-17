/* Official resource lists and in-app checklists for Business SuccessHQ.
   Links were checked against official government sites. Fees and deadlines
   are not listed here because they change — use the official pages. */
(function (global) {
  const SCORE_CRITERIA = [
    {
      id: "demand",
      name: "Market demand",
      help: "How clearly do people already want this? 1 = little demand, 10 = strong, clear demand.",
      highIsBetter: true
    },
    {
      id: "cost",
      name: "Startup cost",
      help: "How affordable is it to start? 1 = very expensive, 10 = inexpensive to start.",
      highIsBetter: true
    },
    {
      id: "skills",
      name: "Skills fit",
      help: "How well does this match skills you already have, or can learn soon? 1 = poor fit, 10 = strong fit.",
      highIsBetter: true
    },
    {
      id: "time",
      name: "Time",
      help: "Can you give this the time it needs? 1 = it does not fit your schedule, 10 = it fits well.",
      highIsBetter: true
    },
    {
      id: "competition",
      name: "Competition",
      help: "How much room is there for you? 1 = very crowded and hard to stand out, 10 = plenty of room.",
      highIsBetter: true
    },
    {
      id: "profit",
      name: "Profit potential",
      help: "After costs, how promising does the money side look to you? 1 = weak, 10 = strong. This is your judgment, not a forecast.",
      highIsBetter: true
    }
  ];

  const VALIDATION = {
    interviews: {
      id: "interviews",
      name: "Customer interviews",
      intro: "Talk with real people who might buy or use this. Write down what they say, in their words. These are suggested steps, not a required number.",
      steps: [
        { id: "who", text: "Write down who you want to talk to, and why they might care." },
        { id: "list", text: "Make a list of people or businesses you could ask." },
        { id: "problem", text: "Ask what problem they have now." },
        { id: "pay", text: "Ask what they pay now, or would be willing to pay." },
        { id: "tried", text: "Ask what they have already tried." },
        { id: "words", text: "Write down what you heard, in their words." },
        { id: "pattern", text: "Look for a pattern after several conversations." }
      ]
    },
    competitors: {
      id: "competitors",
      name: "Competitor research",
      intro: "Learn what already exists. Use public information only. Do not guess at another company's private numbers.",
      steps: [
        { id: "names", text: "Name the businesses already doing something similar." },
        { id: "price", text: "Note what they charge, if that price is public." },
        { id: "like", text: "Note what customers appear to like." },
        { id: "complain", text: "Note what customers appear to complain about." },
        { id: "different", text: "Write how your idea would be different." },
        { id: "look", text: "Review their public website, listing, or storefront, if they have one." },
        { id: "summary", text: "Write a short summary of what you learned." }
      ]
    },
    testOffer: {
      id: "testOffer",
      name: "A simple test offer",
      intro: "Try a small version of the offer before you spend a lot of time or money. Keep it honest and simple.",
      steps: [
        { id: "describe", text: "Describe a small version of the offer you can try soon." },
        { id: "price", text: "Set a simple price, or a clear trade, for the test." },
        { id: "tell", text: "Tell a small group of real people about it." },
        { id: "track", text: "Write down how many people said yes, no, or maybe." },
        { id: "deliver", text: "If someone says yes, deliver the test." },
        { id: "learn", text: "Write what you learned." },
        { id: "decide", text: "Decide whether to continue, change, or stop." }
      ]
    }
  };

  const PATH_STEPS = [
    {
      id: "capture",
      name: "Capture the idea",
      why: "Give the idea a name and a short description so you can come back to it.",
      go: "overview"
    },
    {
      id: "score",
      name: "Score it",
      why: "Rate demand, cost, skills, time, competition, and profit potential, and set how much each one matters.",
      go: "score"
    },
    {
      id: "validate",
      name: "Validate it",
      why: "Talk with possible customers, study public competitors, and try a simple test offer.",
      go: "validate"
    },
    {
      id: "plan",
      name: "Write the plan",
      why: "Turn the idea into a plain-English plan you can follow.",
      go: "plan"
    },
    {
      id: "legal",
      name: "Handle the legal basics",
      why: "If you are ready to operate, use the official checklists for things like a Texas entity, an EIN, or tax accounts. This is not legal advice.",
      go: "playbooks"
    },
    {
      id: "goals",
      name: "Set goals",
      why: "Pick a few clear goals and milestones for this idea or business.",
      go: "goals"
    },
    {
      id: "track",
      name: "Track the numbers",
      why: "Record the figures you actually have, such as sales you type in yourself. This app does not fetch bank or sales data.",
      go: "numbers"
    },
    {
      id: "review",
      name: "Review and decide",
      why: "Look at what you have learned and decide whether to continue, change, or pause.",
      go: "review"
    }
  ];

  const PLAN_SECTIONS = [
    { id: "vision", name: "Vision", hint: "What is this, and what would success look like in plain English?" },
    { id: "customers", name: "Customers", hint: "Who is this for? What problem do they have?" },
    { id: "offer", name: "The offer", hint: "What will you sell or provide, and how is it different?" },
    { id: "operations", name: "How it will run", hint: "What work has to happen day to day? What tools or people will you need?" },
    { id: "money", name: "Money", hint: "How might money come in, and what will it cost to run? Write only figures you know. If you do not know yet, say so. This is not a forecast." },
    { id: "risks", name: "Risks and questions", hint: "What could go wrong, and what do you still need to find out?" },
    { id: "next90", name: "Next 90 days", hint: "What will you actually do in the next 90 days, in order?" }
  ];

  const STARTERS = [
    {
      id: "starter-courier",
      name: "Apex Elite Courier",
      kind: "business",
      blurb: "A delivery courier business. You can rename it after you add it. Nothing is filled in until you choose this."
    },
    {
      id: "starter-lending",
      name: "Apex Elite Lending LLC",
      kind: "business",
      blurb: "A lending business. Licensing depends on what you do and where you do it. This app is not legal advice."
    },
    {
      id: "starter-futures",
      name: "Futures trading",
      kind: "business",
      blurb: "Track this as an activity you manage. This app does not place trades and does not give trading advice."
    }
  ];

  const HABIT_SUGGESTIONS = [
    "Review today's numbers",
    "Reach out to one customer or contact",
    "Work on the top goal for 30 minutes",
    "Write one page in the plan",
    "Check off one playbook step"
  ];

  const PLAYBOOKS = [
    {
      id: "idea-to-launch",
      name: "From idea to launch",
      category: "Starting out",
      summary: "A simple path you can use with any idea: capture it, score it, test it, plan it, then handle the official basics.",
      advice: "This is a checklist, not a promise of results. Skip any step that does not apply.",
      steps: [
        { id: "name", text: "Write the idea in one sentence." },
        { id: "score", text: "Fill in the scorecard and set the weights yourself." },
        { id: "talk", text: "Talk with people who might buy or use it, and write down what they say." },
        { id: "compete", text: "Study public information about similar businesses." },
        { id: "test", text: "Try a small test offer." },
        { id: "plan", text: "Fill in the business plan sections, including the next 90 days." },
        { id: "structure", text: "If you will operate as a formal business, review official guidance on structure and registration.", href: "https://www.sba.gov/counseling/", label: "SBA counseling and business guide" },
        { id: "records", text: "Set up a simple way to record money in and money out. Do not store bank logins or full account numbers in this app." },
        { id: "goals", text: "Add a few goals and the numbers you will track." },
        { id: "review", text: "Set a date to review what you learned and decide the next step." }
      ]
    },
    {
      id: "tx-llc",
      name: "Form a Texas LLC",
      category: "Legal basics",
      summary: "Official steps for forming a limited liability company in Texas, with links to the Texas Secretary of State.",
      advice: "This is not legal advice. An LLC is only one type of business structure. Read the official pages, and consider professional advice before you file. Filing fees change, so use the official site for the current amount.",
      steps: [
        { id: "decide", text: "Confirm that an LLC is the right structure for you.", href: "https://www.sba.gov/counseling/", label: "SBA business guide" },
        { id: "name", text: "Choose a name and check official records to see if it is available.", href: "https://www.sos.texas.gov/corp/searches.shtml", label: "Texas Secretary of State searches" },
        { id: "faqs", text: "Read the official formation frequently asked questions.", href: "https://www.sos.texas.gov/corp/formationfaqs.shtml", label: "Formation of Texas Entities FAQs" },
        { id: "form", text: "Review Form 205, Certificate of Formation — Limited Liability Company, and its instructions.", href: "https://www.sos.texas.gov/corp/forms/205_boc.pdf", label: "Form 205 (PDF)" },
        { id: "instructions", text: "Read the official instructions for Form 205.", href: "https://www.sos.texas.gov/corp/instructions/205.shtml", label: "Form 205 instructions" },
        { id: "options", text: "Choose a filing method. The Secretary of State encourages online filing through SOSPortal.", href: "https://www.sos.texas.gov/corp/options.shtml", label: "Filing options" },
        { id: "portal", text: "If you will file online, create or use a SOSPortal account.", href: "https://www.sos.state.tx.us/corp/portal-access-guide.shtml", label: "SOS Portal account guide" },
        { id: "forms", text: "If you need other business forms, use the official forms list.", href: "https://www.sos.texas.gov/corp/forms_boc.shtml", label: "Business and nonprofit forms" },
        { id: "tax", text: "After formation, find out which Texas tax accounts apply to you.", href: "https://comptroller.texas.gov/taxes/permit/", label: "Texas Online Tax Registration" },
        { id: "ein", text: "If you need a federal Employer Identification Number, apply only on the IRS website. Do not type the full number into this app." }
      ]
    },
    {
      id: "ein",
      name: "Get an Employer Identification Number",
      category: "Legal basics",
      summary: "How to apply for a free EIN from the Internal Revenue Service. Apply only on IRS.gov.",
      advice: "The IRS does not charge a fee to get an EIN. Do not use third-party sites that ask you to pay. Never type a full EIN, a Social Security number, or a tax login into this app. Mark the steps only as you complete them on the IRS site.",
      steps: [
        { id: "read", text: "Read the official IRS page on how to get an EIN.", href: "https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number", label: "IRS: Get an EIN" },
        { id: "need", text: "Confirm whether you need an EIN. The official page explains who should apply." },
        { id: "apply", text: "Apply only through the official IRS process linked from that page. Complete it in one sitting if you use the online form." },
        { id: "save", text: "Save the IRS confirmation in a safe place of your own. Do not store the full EIN in this app." },
        { id: "done", text: "Check this box when the IRS has issued the number. Do not enter the number here." }
      ]
    },
    {
      id: "tx-tax",
      name: "Texas tax accounts",
      category: "Legal basics",
      summary: "Find out whether you need a Texas tax permit or a franchise tax account, using the Comptroller's official pages.",
      advice: "This is not tax advice. Which accounts you need depends on what you sell and how the business is set up. Use the official Comptroller tools, and consider a tax professional if you are unsure.",
      steps: [
        { id: "home", text: "Start at the Texas Comptroller's website.", href: "https://comptroller.texas.gov/", label: "Texas Comptroller of Public Accounts" },
        { id: "franchise", text: "Read the official franchise tax page to see whether it applies to you.", href: "https://comptroller.texas.gov/taxes/franchise/", label: "Franchise tax" },
        { id: "permit", text: "If you may need a tax permit, use the official online tax registration application.", href: "https://comptroller.texas.gov/taxes/permit/", label: "Texas Online Tax Registration" },
        { id: "keep", text: "Keep official notices in your own records. Do not store tax logins or full account numbers in this app." }
      ]
    },
    {
      id: "marketing",
      name: "Marketing basics",
      category: "Getting customers",
      summary: "A short, practical checklist for introducing an offer, with official Small Business Administration guidance.",
      advice: "Keep claims truthful. This checklist is educational. It does not guarantee customers or sales.",
      steps: [
        { id: "customer", text: "Write down who the offer is for, in plain English." },
        { id: "problem", text: "Write the problem you help with, using words your customers actually use." },
        { id: "offer", text: "Write the offer in one short paragraph, including the price if you have one." },
        { id: "where", text: "List the places those customers already look or listen." },
        { id: "sba", text: "Read official SBA guidance on planning and counseling, including marketing as part of a plan.", href: "https://www.sba.gov/counseling/plan-your-business/", label: "SBA: Plan your business" },
        { id: "counsel", text: "If you want free counseling, start at the SBA counseling page.", href: "https://www.sba.gov/counseling/", label: "SBA counseling and mentoring" },
        { id: "test", text: "Try one small, honest outreach step and write down what happened." },
        { id: "review", text: "Review what worked and what did not before you spend more." }
      ]
    },
    {
      id: "tx-courier",
      name: "Texas motor carrier basics",
      category: "By type of work",
      summary: "A starting checklist if your idea involves carrying goods for others in Texas. Official information is on the Texas Department of Motor Vehicles site.",
      advice: "Rules depend on what you haul, the weight of the vehicle, and whether you cross state lines. This is not legal advice. Read the official TxDMV pages, and ask the agency if you are unsure.",
      steps: [
        { id: "home", text: "Start at the Texas Department of Motor Vehicles website.", href: "https://www.txdmv.gov/", label: "TxDMV" },
        { id: "carriers", text: "Read the official motor carriers section.", href: "https://www.txdmv.gov/motor-carriers", label: "TxDMV motor carriers" },
        { id: "need", text: "Find out whether your operation needs motor carrier authority or other credentials." },
        { id: "insurance", text: "Find out what insurance the official rules require for your type of work. Confirm coverage with a licensed insurer. This app does not sell insurance." },
        { id: "records", text: "Plan how you will keep the records the official rules require." }
      ]
    },
    {
      id: "tx-lending",
      name: "Lending in Texas",
      category: "By type of work",
      summary: "A starting checklist if your idea involves making consumer loans in Texas. Official information is on the Office of Consumer Credit Commissioner site.",
      advice: "Lending is regulated. Whether you need a license depends on what you do. This is not legal advice and is not a license application. If any lending would also involve Jamaica or another place, confirm those rules with the official authorities there before you start.",
      steps: [
        { id: "home", text: "Start at the Texas Office of Consumer Credit Commissioner website.", href: "https://occc.texas.gov/", label: "Texas OCCC" },
        { id: "lenders", text: "Read the official page for regulated lenders.", href: "https://occc.texas.gov/industry/regulated-lenders/", label: "Regulated lenders" },
        { id: "forms", text: "If a license may be required, review the official licensing information and forms.", href: "https://occc.texas.gov/industry/regulated-lenders/licensing-forms/", label: "Licensing and forms" },
        { id: "ask", text: "If you are unsure whether a license applies, contact the OCCC using the official site. Do not rely on this app for that decision." },
        { id: "records", text: "Do not store borrower Social Security numbers, full bank account numbers, or other sensitive personal data in this app." }
      ]
    }
  ];

  const LIBRARY = [
    {
      category: "U.S. Small Business Administration",
      items: [
        { name: "SBA home", href: "https://www.sba.gov/", note: "Official starting point for federal small-business help." },
        { name: "Plan your business", href: "https://www.sba.gov/counseling/plan-your-business/", note: "Official guidance on planning, including business plans." },
        { name: "Counseling and mentoring", href: "https://www.sba.gov/counseling/", note: "Find official counseling and local mentoring options." }
      ]
    },
    {
      category: "Texas Secretary of State",
      items: [
        { name: "Secretary of State home", href: "https://www.sos.texas.gov/", note: "Official Texas business filings office. Also at sos.state.tx.us." },
        { name: "Secretary of State (sos.state.tx.us)", href: "https://www.sos.state.tx.us/", note: "The same official office on the sos.state.tx.us address." },
        { name: "Formation FAQs", href: "https://www.sos.texas.gov/corp/formationfaqs.shtml", note: "Official answers about forming a Texas entity." },
        { name: "Filing options and SOSPortal", href: "https://www.sos.texas.gov/corp/options.shtml", note: "Official online and other filing options." },
        { name: "SOS Portal account guide", href: "https://www.sos.state.tx.us/corp/portal-access-guide.shtml", note: "How to create or use a SOSPortal account." },
        { name: "Business searches", href: "https://www.sos.texas.gov/corp/searches.shtml", note: "Official search tools, including name and entity search through SOSPortal." },
        { name: "Business and nonprofit forms", href: "https://www.sos.texas.gov/corp/forms_boc.shtml", note: "Official forms list, including Form 205." },
        { name: "Form 205 (PDF)", href: "https://www.sos.texas.gov/corp/forms/205_boc.pdf", note: "Certificate of Formation — Limited Liability Company." },
        { name: "Form 205 instructions", href: "https://www.sos.texas.gov/corp/instructions/205.shtml", note: "Official instructions for Form 205." }
      ]
    },
    {
      category: "Internal Revenue Service",
      items: [
        { name: "Get an Employer Identification Number", href: "https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number", note: "Official IRS page. Applying for an EIN on IRS.gov is free." }
      ]
    },
    {
      category: "Texas Comptroller of Public Accounts",
      items: [
        { name: "Comptroller home", href: "https://comptroller.texas.gov/", note: "Official Texas tax agency." },
        { name: "Franchise tax", href: "https://comptroller.texas.gov/taxes/franchise/", note: "Official franchise tax information." },
        { name: "Online tax registration", href: "https://comptroller.texas.gov/taxes/permit/", note: "Official application for Texas tax accounts and permits." }
      ]
    },
    {
      category: "Texas Department of Motor Vehicles",
      items: [
        { name: "TxDMV home", href: "https://www.txdmv.gov/", note: "Official state motor vehicle agency." },
        { name: "Motor carriers", href: "https://www.txdmv.gov/motor-carriers", note: "Official information for motor carrier operations in Texas." }
      ]
    },
    {
      category: "Texas Office of Consumer Credit Commissioner",
      items: [
        { name: "OCCC home", href: "https://occc.texas.gov/", note: "Official regulator for many non-depository consumer credit businesses in Texas." },
        { name: "Regulated lenders", href: "https://occc.texas.gov/industry/regulated-lenders/", note: "Official information for regulated lenders." },
        { name: "Licensing and forms", href: "https://occc.texas.gov/industry/regulated-lenders/licensing-forms/", note: "Official licensing information and forms." }
      ]
    }
  ];

  const SPB_IDEAS_CHECKED = "2026-11-16";
  const SPB_IDEAS = [
    {
      id: "spb-n_8Jo9wpsSU",
      videoId: "n_8Jo9wpsSU",
      name: "Street T-shirt stall with a four-shirt bundle",
      summary: "A street stall sells T-shirts as a four-item bundle, with the fourth shirt priced much lower so the set feels like a smart deal rather than a cheap first shirt.",
      quote: "People do not always buy the cheapest thing.",
      videoTitle: "Why Was the Fourth T-Shirt Priced at $2?",
      published: "2026-10-26",
      views: 1568995,
      cost: "not-stated"
    },
    {
      id: "spb-P2xlTO4gQSA",
      videoId: "P2xlTO4gQSA",
      name: "A honey marketplace connecting small keepers with shops",
      summary: "Instead of keeping bees, build a simple marketplace that matches small honey keepers with shops and restaurants, and can also connect members to packaging suppliers.",
      quote: "",
      videoTitle: "Peter Skipped the Hives in This Honey Business Story",
      published: "2026-10-05",
      views: 1465506,
      cost: "not-stated"
    },
    {
      id: "spb-AdabSxkvEjE",
      videoId: "AdabSxkvEjE",
      name: "Bread delivery that sells convenience, not a new loaf",
      summary: "Coordinate orders with an existing bakery and deliver the bread so customers can skip the morning line. The offer is convenience, not a new loaf.",
      quote: "I took an old headache out of people's day.",
      videoTitle: "Bakery Bread, No Oven: A Story About Selling Convenience",
      published: "2026-11-03",
      views: 330299,
      cost: "not-stated"
    },
    {
      id: "spb-na7sqVomxrg",
      videoId: "na7sqVomxrg",
      name: "A bookshop Friday reading club with handwritten recommendations",
      summary: "A neighborhood bookshop hosts a free Friday reading club with tea and adds a short handwritten note explaining why each book is recommended, giving people a reason to stay.",
      quote: "People do not come for a book. They come for company.",
      videoTitle: "Why a Bookshop Serves Free Tea Every Friday",
      published: "2026-10-09",
      views: 309424,
      cost: "not-stated"
    },
    {
      id: "spb-ylnWICUtz2g",
      videoId: "ylnWICUtz2g",
      name: "Handmade candles on hotel and spa monthly contracts",
      summary: "Sell handmade candles on recurring monthly contracts to hotels and spas at a lower unit price, and name scents after local places so guests can buy the same candle later.",
      quote: "One contract customer is worth more than 10 one-off ones.",
      videoTitle: "Tessa Cuts Candle Prices for Hotel Contracts",
      published: "2026-10-26",
      views: 164494,
      cost: "not-stated"
    },
    {
      id: "spb-j1C3OYicc8",
      videoId: "-j1C3OYicc8",
      name: "Swim coaching that makes progress visible",
      summary: "A swim coach posts each child's times on a board, marks improvements, and sends families a short clip of a best swim so progress is easy to see.",
      quote: "Parents do not pay for a lesson, they pay for visible progress.",
      videoTitle: "A Three-Dollar Whiteboard, No Advertising: Swim Coach’s Plan",
      published: "2026-10-20",
      views: 153365,
      cost: "not-stated"
    },
    {
      id: "spb-BnTQ_QsOko4",
      videoId: "BnTQ_QsOko4",
      name: "A home coffee-roasting kit with a bean subscription",
      summary: "Sell a home roasting kit with a short course, then offer a monthly subscription for fresh beans so the same customers keep buying.",
      quote: "",
      videoTitle: "Milo Skipped Roasting Beans to Build a Coffee Kit",
      published: "2026-10-25",
      views: 136372,
      cost: "not-stated"
    },
    {
      id: "spb-O5SBUSzgmx8",
      videoId: "O5SBUSzgmx8",
      name: "A moving marketplace that does not require your own truck",
      summary: "A platform that matches independent movers and their vans with people who need a move, and can also offer packing supplies through the same app.",
      quote: "",
      videoTitle: "Theo Builds a Truck-Free System for Moving Jobs",
      published: "2026-10-07",
      views: 133584,
      cost: "not-stated"
    },
    {
      id: "spb-WTh4SMklxFs",
      videoId: "WTh4SMklxFs",
      name: "A hair salon with subscriptions, referrals, and a $1 makeover raffle",
      summary: "A salon sells monthly and yearly subscriptions with a free evening blow-dry, uses a two-way referral discount, and runs a weekly $1 raffle for a makeover.",
      quote: "",
      videoTitle: "How a Salon Used a $1 Makeover Raffle to Draw Customers",
      published: "2026-10-17",
      views: 66862,
      cost: "not-stated"
    },
    {
      id: "spb-InjzL-_Jivk",
      videoId: "InjzL-_Jivk",
      name: "A dog-walking marketplace with ratings",
      summary: "A marketplace that connects freelance dog walkers with owners, using ratings and reviews, rather than walking the dogs yourself.",
      quote: "",
      videoTitle: "A Dog-Walking App That Needed No Dog Walking",
      published: "2026-10-16",
      views: 34680,
      cost: "not-stated"
    },
    {
      id: "spb-_eOG-QByG9s",
      videoId: "_eOG-QByG9s",
      name: "A taco truck that names its farm and takes orders by text",
      summary: "A taco truck names the farm that supplies its corn and lets customers text their orders before they arrive so the line moves faster.",
      quote: "You have a story. You simply never told it.",
      videoTitle: "Nathan’s Taco Truck Had Excellent Food but No Name",
      published: "2026-10-24",
      views: 24231,
      cost: "not-stated"
    }
  ];

  global.BIZHQ_DATA = {
    SCORE_CRITERIA,
    VALIDATION,
    PATH_STEPS,
    PLAN_SECTIONS,
    STARTERS,
    HABIT_SUGGESTIONS,
    PLAYBOOKS,
    LIBRARY,
    SPB_IDEAS,
    SPB_IDEAS_CHECKED
  };
})(window);
