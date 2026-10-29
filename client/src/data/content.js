/**
 * Original site copy for supporting pages.
 * Business details are configurable placeholders — replace the values in
 * `siteInfo` with the real brand details before launch.
 */

export const siteInfo = {
  brand: 'EcShopping',
  tagline: 'Local sellers, delivered fresh',
  email: 'support@ecshopping.example',
  phone: '+91 90000 00000',
  hours: 'Mon–Sat, 9:00 AM – 7:00 PM (IST)',
  address: 'Operations Hub, Erode, Tamil Nadu, India',
  registered: 'EcShopping Marketplace',
  currency: 'INR (₹)'
};

/**
 * Manageable social media channels for the storefront footer.
 * URLs can be customized directly here or overridden via VITE_* environment variables.
 * Empty or non-http links are gracefully skipped to avoid dead "#" links.
 */
export const socialLinks = [
  {
    name: 'Instagram',
    key: 'instagram',
    url: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_INSTAGRAM_URL) || 'https://www.instagram.com/ecshopping.in',
    ariaLabel: 'Follow EcShopping on Instagram'
  },
  {
    name: 'Facebook',
    key: 'facebook',
    url: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FACEBOOK_URL) || 'https://www.facebook.com/ecshopping.in',
    ariaLabel: 'Follow EcShopping on Facebook'
  },
  {
    name: 'YouTube',
    key: 'youtube',
    url: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_YOUTUBE_URL) || 'https://www.youtube.com/@ecshopping',
    ariaLabel: 'Subscribe to EcShopping on YouTube'
  }
];

export const faqs = [
  {
    category: 'Orders & Payment',
    items: [
      {
        q: 'Which payment methods can I use?',
        a: 'Cash on Delivery and PhonePe are both available at checkout. PhonePe payments are handled on the payment provider’s secure screen.'
      },
      {
        q: 'Is my card or UPI data stored by EcShopping?',
        a: 'No. This interface never asks for or stores UPI PINs, card numbers, CVVs or net-banking passwords. Those details will only ever be collected on the payment provider’s own secure screens after integration.'
      },
      {
        q: 'Can I change or cancel an order after placing it?',
        a: 'Orders can be changed or cancelled before they are packed. Raise a request from your order details page or contact support with your order ID.'
      }
    ]
  },
  {
    category: 'Delivery',
    items: [
      {
        q: 'How long does delivery take?',
        a: 'Standard delivery takes 3–5 business days and express delivery takes 1–2 business days. Delivery windows depend on your pincode and the seller’s location.'
      },
      {
        q: 'Is there a delivery fee?',
        a: 'Standard delivery is ₹50 and free on orders above ₹499. Express delivery is ₹120.'
      },
      {
        q: 'Do you deliver across India?',
        a: 'We currently serve Tamil Nadu and select neighbouring states. Enter your pincode at checkout to confirm serviceability.'
      }
    ]
  },
  {
    category: 'Returns & Refunds',
    items: [
      {
        q: 'What if my order arrives damaged?',
        a: 'Report it within 48 hours with a photo from the order details page. Eligible orders get a free replacement or a refund to the original payment method.'
      },
      {
        q: 'Can fresh produce be returned?',
        a: 'For quality reasons (damage, spoilage, wrong item) yes. Change-of-mind returns are not accepted on perishable items, which is standard for fresh food retail.'
      },
      {
        q: 'How long does a refund take?',
        a: 'Once approved, refunds are initiated within 2 business days. UPI and card refunds usually settle in 3–7 business days depending on the bank.'
      }
    ]
  },
  {
    category: 'Account & Data',
    items: [
      {
        q: 'Do I need an account to order?',
        a: 'You can check out as a guest — an account is created for you automatically so you can track orders later. You can also register explicitly from the login page.'
      },
      {
        q: 'How is my personal data used?',
        a: 'Only to fulfil orders, provide support and send updates you opt into. See the Privacy Policy for the full description and for how to request deletion.'
      }
    ]
  }
];

export const shippingPolicy = [
  {
    heading: 'Order processing',
    paragraphs: [
      'Orders placed before 4:00 PM IST on a business day are usually packed the same day. Orders placed after that, or on Sundays and public holidays, are processed on the next business day.',
      'During harvest peaks and festival weeks, processing may take an extra day. Any such delay is communicated on the order tracking page.'
    ]
  },
  {
    heading: 'Delivery timelines',
        bullets: [
          'Standard delivery: 3–5 business days.',
          'Express delivery: 1–2 business days (select pincodes).',
          'Livestock and live animal orders: scheduled directly with the seller after order confirmation.'
        ]
  },
  {
    heading: 'Shipping charges',
    paragraphs: [
      'Standard delivery is charged at ₹50 and is waived automatically for orders of ₹499 and above. Express delivery is charged at ₹120 regardless of order value.'
    ]
  },
  {
    heading: 'Tracking your order',
    paragraphs: [
      'Every order gets a status timeline on the order details page and a tracking lookup on the Track Order page. You will also receive status updates on the email address used at checkout.'
    ]
  },
  {
    heading: 'Delivery coverage',
    paragraphs: [
      'Serviceability is checked with the pincode entered at checkout. If your pincode is not serviceable, the checkout will let you know before payment is attempted.'
    ]
  }
];

export const returnsPolicy = [
  {
    heading: '48-hour reporting window',
    paragraphs: [
      'Damaged, spoiled, incomplete or incorrect orders must be reported within 48 hours of delivery with a supporting photo. Requests raised after that window are reviewed manually.'
    ]
  },
  {
    heading: 'What is eligible',
    bullets: [
      'Items damaged in transit or delivered spoiled.',
      'Wrong item or wrong quantity delivered.',
      'Missing items from the order.',
      'Sealed pantry items that are unopened and within date.'
    ]
  },
  {
    heading: 'What is not eligible',
    bullets: [
      'Perishable items returned for a change of mind.',
      'Items that were opened, cooked with or stored incorrectly.',
      'Live animals and livestock, which are handled case-by-case with the seller.',
      'Gift cards and promotional freebies.'
    ]
  },
  {
    heading: 'Refund timelines',
    paragraphs: [
      'Approved refunds are initiated within 2 business days. UPI and card payments typically settle within 3–7 business days; wallet and bank transfers may take up to 7 business days. Original shipping charges are refunded when the error is ours.'
    ]
  },
  {
    heading: 'How to raise a request',
    paragraphs: [
      'Open the order from your account, choose the item and the reason, and attach a photo. Our support team responds within one business day. You can also write to ' +
        siteInfo.email +
        ' with your order ID.'
    ]
  }
];

export const privacyPolicy = [
  {
    heading: 'What we collect',
    paragraphs: [
      'To fulfil orders we collect your name, delivery address, phone number and email. Payment details are never collected by this website — they are entered only on the payment provider’s screens after integration.'
    ]
  },
  {
    heading: 'How we use it',
    bullets: [
      'Processing, packing and delivering your orders.',
      'Order status updates and support responses.',
      'Fraud prevention and marketplace safety checks.',
      'Marketing emails only when you explicitly subscribe.'
    ]
  },
  {
    heading: 'Who we share it with',
    paragraphs: [
      'Order details are shared with the seller fulfilling your order and with the logistics partner assigned to the shipment. We do not sell personal data to third parties.'
    ]
  },
  {
    heading: 'Local storage on this device',
    paragraphs: [
      'We keep your cart, wishlist and session in your browser’s local storage so your experience stays smooth between visits. Clearing your browser data removes them.'
    ]
  },
  {
    heading: 'Your rights',
    bullets: [
      'Request a copy of the data we hold about you.',
      'Request correction or deletion of your account data.',
      'Unsubscribe from marketing at any time.',
      'Raise a complaint with the relevant data protection authority.'
    ]
  },
  {
    heading: 'Contact',
    paragraphs: ['Questions about this policy can be sent to ' + siteInfo.email + '.']
  }
];

export const termsPolicy = [
  {
    heading: 'About this marketplace',
    paragraphs: [
      'EcShopping is a marketplace connecting independent sellers with customers. Contracts of sale for listed products are formed between the buyer and the seller; EcShopping facilitates discovery, payment routing and support.'
    ]
  },
  {
    heading: 'Accounts',
    paragraphs: [
      'You are responsible for keeping your login credentials secure. Provide accurate contact and delivery information — orders are dispatched to the address entered at checkout.'
    ]
  },
  {
    heading: 'Pricing and availability',
    paragraphs: [
      'Prices, offers and stock levels are shown in real time from the catalogue. In case of a pricing error or an out-of-stock item after order placement, we will inform you and offer a refund or an alternative.'
    ]
  },
  {
    heading: 'Deliveries and livestock',
    paragraphs: [
      'Buyers of livestock are responsible for confirming age, health documents and transport arrangements with the seller before dispatch. Such sales may require identity verification.'
    ]
  },
  {
    heading: 'Prohibited conduct',
    bullets: [
      'Listing or ordering items that are illegal to trade.',
      'Manipulating reviews, ratings or offers.',
      'Abusing support or refund processes.',
      'Reselling ordered goods without permission.'
    ]
  },
  {
    heading: 'Liability',
    paragraphs: [
      'To the extent permitted by law, our liability is limited to the value of the order in question. Nothing in these terms limits rights you have under applicable consumer protection law.'
    ]
  },
  {
    heading: 'Changes',
    paragraphs: [
      'These terms may be updated as the marketplace evolves. Material changes will be highlighted on this page with a revised date.'
    ]
  }
];

export const blogPosts = [
  {
    slug: 'why-cold-pressed-oil-matters',
    title: 'Why cold-pressed oil deserves a place in your kitchen',
    excerpt: 'Heat changes flavour and nutrition. Here is what low-temperature pressing keeps that refining removes.',
    tag: 'Nutrition',
    author: 'EcShopping Editorial',
    date: '2026-09-28',
    readTime: '5 min read',
    image: 'https://images.unsplash.com/photo-1611077543781-a96c138b1d98?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        paragraphs: [
          'Cold-pressed (or wood-pressed) oil is extracted at low temperature, so the seed does not get cooked in the process. That is a small technical detail with a big daily effect on flavour, aroma and what survives in the bottle.',
          'Refining, by contrast, uses heat and chemical solvents to push extraction yields up. It produces a neutral oil that keeps longer on a shelf, but the natural antioxidants and the character of the seed are largely gone.'
        ]
      },
      {
        heading: 'What stays in the bottle',
        bullets: [
          'Natural antioxidants such as vitamin E and polyphenols.',
          'The seed’s own aroma and colour.',
          'A shorter, more honest ingredient list — just the seed.',
          'Smaller batch sizes, often pressed to order.'
        ]
      },
      {
        heading: 'How to use it',
        paragraphs: [
          'Cold-pressed oils are best for everyday cooking, tempering and dressings. Store them away from direct sunlight and finish a bottle within its shelf life rather than keeping it for years — fresh oil is the whole point.'
        ]
      }
    ]
  },
  {
    slug: 'how-to-read-a-honey-label',
    title: 'How to read a honey label without getting fooled',
    excerpt: 'Raw, unpasteurised and single-origin are not marketing words. They tell you how the honey behaves.',
    tag: 'Buying guides',
    author: 'EcShopping Editorial',
    date: '2026-09-12',
    readTime: '4 min read',
    image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        paragraphs: [
          'Genuine raw honey crystallises. That is not spoilage — it is a sign that the honey has not been heavily heated or fine-filtered. If a jar stays perfectly clear and runny for years, ask what was done to it.'
        ]
      },
      {
        heading: 'Words worth understanding',
        bullets: [
          'Raw: never heated above hive temperature.',
          'Unfiltered: pollen traces and natural solids may remain.',
          'Single-origin: from one floral source and one region.',
          'Blend: honey from multiple sources, often countries.'
        ]
      },
      {
        heading: 'A quick kitchen test',
        paragraphs: [
          'Stir a spoon of honey into warm — not boiling — water. Raw honey dissolves slowly and keeps some aroma. This is not a lab test, but paired with a transparent label it tells you a lot.'
        ]
      }
    ]
  },
  {
    slug: 'seasonal-produce-calendar',
    title: 'A simple seasonal produce calendar for South India',
    excerpt: 'Buying in season means better taste, lower prices and less produce wasted in transit.',
    tag: 'Seasonal',
    author: 'EcShopping Editorial',
    date: '2026-08-30',
    readTime: '6 min read',
    image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        paragraphs: [
          'Farms do not run on supermarket schedules. When you buy what is being harvested that week, you get produce that was picked ripe instead of picked to survive a long journey.'
        ]
      },
      {
        heading: 'Roughly, through the year',
        bullets: [
          'Jun–Aug: mangoes, jackfruit, gourds, greens.',
          'Sep–Nov: tomatoes, brinjal, beans, bananas.',
          'Dec–Feb: carrots, beetroot, cabbage, citrus.',
          'Mar–May: melons, drumstick, raw mango, spinach.'
        ]
      },
      {
        heading: 'Why it matters',
        paragraphs: [
          'In-season produce needs fewer interventions to look good, so growers can spend less on inputs. It also travels shorter distances, which is friendlier to both the produce and the planet.'
        ]
      }
    ]
  },
  {
    slug: 'packing-fresh-without-plastic',
    title: 'How we pack fresh orders without drowning them in plastic',
    excerpt: 'Reusable crates, paper padding and route planning do most of the heavy lifting.',
    tag: 'Sustainability',
    author: 'EcShopping Editorial',
    date: '2026-08-16',
    readTime: '4 min read',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        paragraphs: [
          'Packaging is where a lot of e-commerce quietly undoes its own good intentions. We start from a simple rule: the box should protect the food, not outlive it by a century.'
        ]
      },
      {
        heading: 'What we use instead',
        bullets: [
          'Returnable crates for produce on local routes.',
          'Paper and starch-based padding for glass jars.',
          'Right-sized cartons to cut empty space and filler.',
          'Consolidated dispatch so one van does more per trip.'
        ]
      },
      {
        heading: 'What still needs work',
        paragraphs: [
          'Chilled dairy and meat still rely on some insulated liners. We are piloting reusable cold bags with partner stores and will publish the numbers once we have a full season of data.'
        ]
      }
    ]
  }
];

export function getBlogPost(slug) {
  return blogPosts.find((post) => post.slug === slug) || null;
}

export const stores = [
  {
    id: 'store-erode',
    name: 'EcShopping Erode Hub',
    city: 'Erode',
    address: '12 Brough Road, near Panneerselvam Park, Erode',
    pincode: '638001',
    phone: '+91 90000 00000',
    hours: 'Mon–Sat, 9:00 AM – 7:00 PM',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Erode%2C+Tamil+Nadu'
  },
  {
    id: 'store-coimbatore',
    name: 'EcShopping Coimbatore Store',
    city: 'Coimbatore',
    address: '45 Avinashi Road, Peelamedu, Coimbatore',
    pincode: '641004',
    phone: '+91 90000 00001',
    hours: 'Mon–Sun, 8:30 AM – 8:30 PM',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Coimbatore%2C+Tamil+Nadu'
  },
  {
    id: 'store-chennai',
    name: 'EcShopping Chennai Store',
    city: 'Chennai',
    address: '8 Anna Salai, Teynampet, Chennai',
    pincode: '600018',
    phone: '+91 90000 00002',
    hours: 'Mon–Sun, 9:00 AM – 9:00 PM',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Chennai%2C+Tamil+Nadu'
  },
  {
    id: 'store-madurai',
    name: 'EcShopping Madurai Store',
    city: 'Madurai',
    address: '23 Bypass Road, KK Nagar, Madurai',
    pincode: '625020',
    phone: '+91 90000 00003',
    hours: 'Mon–Sat, 9:00 AM – 7:30 PM',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Madurai%2C+Tamil+Nadu'
  }
];

export const bulkOrderInfo = {
  minQuantity: '25 units per product',
  leadTime: '5–10 business days depending on the product and pincode',
  discount: 'Tiered pricing from 8% up to 18% based on volume',
  useCases: ['Offices and co-working spaces', 'Weddings and events', 'Retail and resellers', 'Institutions and canteens'],
  steps: [
    'Send your requirement list using the form.',
    'Our team replies with availability, pricing and lead time.',
    'Confirm the quote and we schedule packing and dispatch.',
    'Delivery is tracked from your account as with any order.'
  ]
};

/* ---------------------------------------------------------------------
   Presentation-only marketing content (Phase 1 storefront decision D5).
   Imagery and taglines below are visual placeholders keyed by category
   NAME — the categories themselves always come from the server
   (GET /api/categories/public). No product data, ratings, sales counts
   or badges live here.
   --------------------------------------------------------------------- */

const IMG = 'https://images.unsplash.com/photo-';
const img = (id, w = 700) => `${IMG}${id}?auto=format&fit=crop&w=${w}&q=80`;

export const DEFAULT_CATEGORY_IMAGE = img('1610832958506-aa56368176cf');

export const categoryDisplay = [
  { name: 'Fresh Produce', tagline: 'Vegetables, fruits & greens', image: img('1610832958506-aa56368176cf'), blurb: 'Harvested by partner farms and packed the same morning.' },
  { name: 'Pantry Staples', tagline: 'Rice, oils, spices & flours', image: img('1596040033229-a9821ebd058d'), blurb: 'Cold-pressed oils, stone-ground spices and everyday grains.' },
  { name: 'Dairy & Eggs', tagline: 'Milk, curd, ghee & eggs', image: img('1528750997573-59b89d56f4f7'), blurb: 'Collected daily from small dairy farms near your city.' },
  { name: 'Honey & Sweeteners', tagline: 'Wild honey & palm jaggery', image: img('1587049352846-4a222e784d38'), blurb: 'Ethically harvested raw honey, palm jaggery, and unrefined sweeteners.' },
  { name: 'Livestock', tagline: 'Cattle, sheep & poultry', image: img('1546445317-29f4545e9d53'), blurb: 'Verified native breeds with health records from trusted breeders.' },
  { name: 'Pets & Birds', tagline: 'Feed, care & accessories', image: img('1552728089-57bdde30beb3'), blurb: 'Nutrition and care essentials for the animals at home.' },
  { name: 'Home & Lifestyle', tagline: 'Handmade, garden & living', image: img('1485955900006-10f4d324d411'), blurb: 'Handmade goods, gardening kits and slow-living essentials.' }
];

export function categoryDisplayForName(name) {
  const key = String(name || '').trim().toLowerCase();
  if (key) {
    const found = categoryDisplay.find((c) => c.name.toLowerCase() === key);
    if (found) return found;
    return { name: String(name), title: String(name), tagline: '', image: DEFAULT_CATEGORY_IMAGE, blurb: '' };
  }
  return { name: '', title: '', tagline: '', image: DEFAULT_CATEGORY_IMAGE, blurb: '' };
}

/** Copy/imagery for the collection views the server can genuinely back (D2). */
export const collectionDisplay = {
  'new-arrivals': {
    title: 'New Arrivals',
    subtitle: 'Fresh listings from our sellers, newest first',
    image: img('1488459716781-31db52582fe9', 1000)
  },
  deals: {
    title: 'Weekend Deals',
    subtitle: 'Lower prices this week on seller-priced items',
    image: img('1596040033229-a9821ebd058d', 1000)
  }
};

/** Collection slugs that exist as URLs but have no server-data basis yet. */
export const KNOWN_UNSUPPORTED_COLLECTIONS = [
  'bestsellers',
  'special',
  'combos',
  'farm-fresh',
  'weight-gain',
  'pregnancy-care',
  'kids-wellness',
  'diabetes-friendly',
  'weight-loss',
  'high-protein'
];

export const benefits = [
  { icon: 'Sprout', title: 'Sourced from verified sellers', text: 'Every seller is identity-verified and reviewed before listings go live.' },
  { icon: 'Truck', title: 'Same-day dispatch', text: 'Orders placed before 4 PM are packed the same day from the nearest hub.' },
  { icon: 'ShieldCheck', title: 'Quality you can check', text: 'Produce is residue-tested and every listing carries honest specs.' },
  { icon: 'RotateCcw', title: 'Easy replacements', text: 'Damaged or wrong item? Raise a replacement request within 48 hours.' },
  { icon: 'IndianRupee', title: 'Transparent pricing', text: 'What you see is what you pay — no hidden handling fees at checkout.' },
  { icon: 'HeartHandshake', title: 'Fair for sellers too', text: 'Local sellers keep a fairer share of every sale they make.' }
];

export const testimonials = [
  { id: 't1', name: 'Priya Raman', location: 'Chennai', text: 'The tomatoes were firm and fresh — picked that morning, exactly as described. Delivery arrived on the second day without any bruising.' },
  { id: 't2', name: 'Arun Kumar', location: 'Coimbatore', text: 'Genuine forest honey with a rich, floral taste. The jar was sealed well and the seller included a note about the harvest.' },
  { id: 't3', name: 'Meena Sundaram', location: 'Madurai', text: 'Sona masuri rice that cooks light and fluffy, just like the local mill rice we grew up with. Ordering again for the festive season.' }
];

export const shopVideos = [
  {
    id: 'vid-oil',
    title: 'How cold-pressed oil is made',
    poster: img('1611077543781-a96c138b1d98', 900),
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
  },
  {
    id: 'vid-honey',
    title: 'Forest honey, straight from the comb',
    poster: img('1587049352846-4a222e784d38', 900),
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
  },
  {
    id: 'vid-farm',
    title: 'A morning at our partner farms',
    poster: img('1592924357228-91a4daadcfea', 900),
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4'
  },
  {
    id: 'vid-pasta',
    title: 'Cooking with millet pasta',
    poster: img('1542838132-92c53300491e', 900),
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4'
  }
];

export const marqueeMessages = [
  'Farm-fresh listings from local sellers',
  'Pesticide free',
  'Premium quality',
  'Direct from farms',
  'Free delivery over ₹499',
  'Every seller identity-verified'
];

export const announcementMessages = [
  '⚡ Free delivery across Tamil Nadu on orders above ₹499',
  '🛡️ 100% Verified independent sellers & direct farm producers',
  '📦 Cash on Delivery & Secure Online Checkout available'
];
