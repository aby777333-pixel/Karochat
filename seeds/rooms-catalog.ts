/**
 * Karochat — Rooms Catalog Seed File (v7)
 * ----------------------------------------
 * Drop into: seeds/rooms-catalog.ts
 * Run via:   npm run seed:rooms
 *
 * Generates ~12,000-15,000 pre-existing official rooms across 20 categories,
 * with full global per-country coverage for Regional, Romance, and LGBTQ+ sections.
 *
 * Idempotent: re-running upserts on (subcategory_slug, name, scale_index).
 *
 * Philosophy: rooms exist as scaffolding. Most start empty. They're the
 * invitation. A queer Tamil student in Coimbatore should see their room
 * exists on day one.
 */

// ============================================================================
// TYPES
// ============================================================================

export type RoomFlag =
  | 'adult'                       // 🔞 18+ gate enforced on entry
  | 'voice_enabled'               // 🎙️ voice room available
  | 'cam_enabled'                 // 📹 webcam available
  | 'conference_capable'          // 📺 full LiveKit conference
  | 'verified_students_only'      // 🎓 must hold student verification
  | 'verified_professors_only'    // 👨‍🏫 must hold professor verification
  | 'verified_professionals_only' // 💼 must hold professional verification
  | 'listed_private'              // 🔒 visible in lobby, requires request
  | 'nsfw_uploads_allowed'        // allows explicit image/video uploads (adult rooms only)
  | 'crisis_card_pinned'          // pins localized crisis resources at top
  | 'anonymous_only'              // all members join as anon-####
  | 'slow_mode'                   // owner can set cooldown
  | 'time_bound'                  // activates only during specific window
  | 'whisper_only'                // public chat disabled, DMs only
  | 'verified_only';              // only registered (non-guest) users

export type SeedCategory = {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  sort_order: number;
};

export type SeedSubcategory = {
  category_slug: string;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  region?: string;
  language?: string;
};

export type SeedRoom = {
  category_slug: string;
  subcategory_slug: string;
  name: string;          // lowercase-hyphenated, no `:1` suffix in seed
  topic: string;         // one-line description shown on hover
  flags: RoomFlag[];
  capacity: number;      // 2-500, default 50
  tags: string[];
  language?: string;     // ISO 639-1 code
  region?: string;       // ISO 3166-1 alpha-2 country code, or 'global'
  pinned_message?: string;
};

// ============================================================================
// CATEGORIES (20 top-level)
// ============================================================================

export const CATEGORIES: SeedCategory[] = [
  { slug: 'regional',  name: 'Regional',                   emoji: '🌍', description: 'Rooms by country, state, and city',                sort_order: 1 },
  { slug: 'romance',   name: 'Romance & Dating',           emoji: '💖', description: 'Flirt, date, find love, find now',                 sort_order: 2 },
  { slug: 'lgbtq',     name: 'LGBTQ+ & Queer',             emoji: '🌈', description: 'Queer-affirming spaces for every identity',        sort_order: 3 },
  { slug: 'adult',     name: 'Adult & Sex-Positive',       emoji: '🔥', description: '18+ only. Free, frank, consensual',                sort_order: 4 },
  { slug: 'identity',  name: 'Identity & Community',       emoji: '🪞', description: 'Beyond binaries: every way of being human',        sort_order: 5 },
  { slug: 'students',  name: 'Students Global',            emoji: '🎓', description: 'Study, ask, learn, meet',                          sort_order: 6 },
  { slug: 'career',    name: 'Career & Work',              emoji: '💼', description: 'Industries, professions, work life',               sort_order: 7 },
  { slug: 'finance',   name: 'Money, Trading & Investing', emoji: '💰', description: 'Markets, money, building wealth',                  sort_order: 8 },
  { slug: 'outdoors',  name: 'Travel, Trek & Outdoors',    emoji: '🥾', description: 'Mountains, roads, oceans, wild places',            sort_order: 9 },
  { slug: 'events',    name: 'Events & Cultural Programs', emoji: '🎉', description: 'Concerts, festivals, parties, meetups',            sort_order: 10 },
  { slug: 'games',     name: 'Games & Esports',            emoji: '🎮', description: 'Play, compete, hang out',                          sort_order: 11 },
  { slug: 'music',     name: 'Music',                      emoji: '🎵', description: 'Genre, language, instrument, scene',                sort_order: 12 },
  { slug: 'arts',      name: 'Arts & Creative',            emoji: '🎨', description: 'Make things, share what you make',                  sort_order: 13 },
  { slug: 'food',      name: 'Food & Cooking',             emoji: '🍳', description: 'Cook, eat, debate, recommend',                     sort_order: 14 },
  { slug: 'wellness',  name: 'Health, Fitness & Wellness', emoji: '🏋️', description: 'Body, mind, recovery, growth',                     sort_order: 15 },
  { slug: 'tech',      name: 'Tech & Builders',            emoji: '🧠', description: 'Code, hardware, AI, internet culture',             sort_order: 16 },
  { slug: 'pets',      name: 'Pets & Animals',             emoji: '🐈', description: 'For everyone with non-human family',                sort_order: 17 },
  { slug: 'books',     name: 'Books, Learning & Ideas',    emoji: '📚', description: 'Read, learn, debate, philosophize',                sort_order: 18 },
  { slug: 'faith',     name: 'Faith & Spirituality',       emoji: '🛐', description: 'All paths welcome, all questions welcome',         sort_order: 19 },
  { slug: 'vibes',     name: 'Just Vibes & Random',        emoji: '🎭', description: 'Memes, confessions, 3am thoughts',                 sort_order: 20 },
];

// ============================================================================
// COUNTRIES (~120 countries, with cities + tier flag)
// ============================================================================

export type Country = {
  iso: string;
  name: string;
  cities: string[];
  states?: string[];
  primary_language: string;
  is_tier_1?: boolean;
};

export const COUNTRIES: Country[] = [
  // ---------- South Asia ----------
  { iso: 'IN', name: 'India', is_tier_1: true, primary_language: 'en',
    states: ['Tamil Nadu', 'Karnataka', 'Kerala', 'Andhra Pradesh', 'Telangana', 'Maharashtra', 'Gujarat', 'Rajasthan', 'Punjab', 'Haryana', 'Delhi-NCR', 'Uttar Pradesh', 'West Bengal', 'Bihar', 'Odisha', 'Madhya Pradesh', 'Chhattisgarh', 'Jharkhand', 'Assam', 'Northeast', 'Goa', 'Kashmir', 'Uttarakhand', 'Himachal Pradesh'],
    cities: ['Chennai', 'Coimbatore', 'Madurai', 'Trichy', 'Salem', 'Bangalore', 'Mysuru', 'Mangaluru', 'Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Hyderabad', 'Visakhapatnam', 'Vijayawada', 'Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Ahmedabad', 'Surat', 'Vadodara', 'Jaipur', 'Udaipur', 'Jodhpur', 'Chandigarh', 'Amritsar', 'Ludhiana', 'Gurgaon', 'Noida', 'Faridabad', 'Delhi', 'Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Kolkata', 'Howrah', 'Patna', 'Bhubaneswar', 'Cuttack', 'Bhopal', 'Indore', 'Gwalior', 'Raipur', 'Ranchi', 'Jamshedpur', 'Guwahati', 'Shillong', 'Imphal', 'Aizawl', 'Kohima', 'Itanagar', 'Agartala', 'Gangtok', 'Panaji', 'Puducherry', 'Srinagar', 'Jammu', 'Dehradun', 'Shimla'] },
  { iso: 'PK', name: 'Pakistan', is_tier_1: true, primary_language: 'ur',
    cities: ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Hyderabad-PK'] },
  { iso: 'BD', name: 'Bangladesh', is_tier_1: true, primary_language: 'bn',
    cities: ['Dhaka', 'Chittagong', 'Sylhet', 'Khulna', 'Rajshahi', 'Barisal'] },
  { iso: 'LK', name: 'Sri Lanka', primary_language: 'si', cities: ['Colombo', 'Kandy', 'Galle', 'Jaffna', 'Negombo'] },
  { iso: 'NP', name: 'Nepal', primary_language: 'ne', cities: ['Kathmandu', 'Pokhara', 'Lalitpur', 'Biratnagar'] },
  { iso: 'BT', name: 'Bhutan', primary_language: 'dz', cities: ['Thimphu', 'Paro'] },
  { iso: 'MV', name: 'Maldives', primary_language: 'dv', cities: ['Male'] },
  { iso: 'AF', name: 'Afghanistan', primary_language: 'ps', cities: ['Kabul', 'Herat', 'Kandahar', 'Mazar-i-Sharif'] },

  // ---------- East & Southeast Asia ----------
  { iso: 'CN', name: 'China', is_tier_1: true, primary_language: 'zh',
    cities: ['Beijing', 'Shanghai', 'Shenzhen', 'Guangzhou', 'Hong Kong', 'Chengdu', 'Hangzhou', 'Wuhan', 'Xian', 'Chongqing', 'Nanjing', 'Tianjin'] },
  { iso: 'TW', name: 'Taiwan', primary_language: 'zh', cities: ['Taipei', 'Kaohsiung', 'Taichung', 'Tainan'] },
  { iso: 'JP', name: 'Japan', is_tier_1: true, primary_language: 'ja',
    cities: ['Tokyo', 'Osaka', 'Kyoto', 'Fukuoka', 'Sapporo', 'Nagoya', 'Yokohama', 'Hiroshima', 'Sendai', 'Okinawa', 'Kobe'] },
  { iso: 'KR', name: 'South Korea', is_tier_1: true, primary_language: 'ko',
    cities: ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju', 'Jeju', 'Suwon'] },
  { iso: 'MN', name: 'Mongolia', primary_language: 'mn', cities: ['Ulaanbaatar'] },
  { iso: 'SG', name: 'Singapore', is_tier_1: true, primary_language: 'en', cities: ['Singapore'] },
  { iso: 'MY', name: 'Malaysia', is_tier_1: true, primary_language: 'ms',
    cities: ['Kuala Lumpur', 'Penang', 'Johor Bahru', 'Ipoh', 'Kuching', 'Kota Kinabalu', 'Malacca'] },
  { iso: 'TH', name: 'Thailand', is_tier_1: true, primary_language: 'th',
    cities: ['Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya', 'Krabi', 'Koh Samui', 'Hua Hin'] },
  { iso: 'VN', name: 'Vietnam', is_tier_1: true, primary_language: 'vi',
    cities: ['Ho Chi Minh City', 'Hanoi', 'Da Nang', 'Hue', 'Hoi An', 'Nha Trang', 'Can Tho'] },
  { iso: 'ID', name: 'Indonesia', is_tier_1: true, primary_language: 'id',
    cities: ['Jakarta', 'Bali', 'Surabaya', 'Bandung', 'Yogyakarta', 'Medan', 'Makassar', 'Semarang'] },
  { iso: 'PH', name: 'Philippines', is_tier_1: true, primary_language: 'tl',
    cities: ['Manila', 'Cebu', 'Davao', 'Quezon City', 'Baguio', 'Iloilo', 'Boracay'] },
  { iso: 'MM', name: 'Myanmar', primary_language: 'my', cities: ['Yangon', 'Mandalay', 'Naypyidaw'] },
  { iso: 'KH', name: 'Cambodia', primary_language: 'km', cities: ['Phnom Penh', 'Siem Reap', 'Sihanoukville'] },
  { iso: 'LA', name: 'Laos', primary_language: 'lo', cities: ['Vientiane', 'Luang Prabang'] },
  { iso: 'BN', name: 'Brunei', primary_language: 'ms', cities: ['Bandar Seri Begawan'] },
  { iso: 'TL', name: 'Timor-Leste', primary_language: 'pt', cities: ['Dili'] },

  // ---------- Middle East ----------
  { iso: 'AE', name: 'UAE', is_tier_1: true, primary_language: 'ar',
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah'] },
  { iso: 'SA', name: 'Saudi Arabia', is_tier_1: true, primary_language: 'ar',
    cities: ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Khobar'] },
  { iso: 'QA', name: 'Qatar', primary_language: 'ar', cities: ['Doha', 'Al Wakrah'] },
  { iso: 'KW', name: 'Kuwait', primary_language: 'ar', cities: ['Kuwait City'] },
  { iso: 'BH', name: 'Bahrain', primary_language: 'ar', cities: ['Manama'] },
  { iso: 'OM', name: 'Oman', primary_language: 'ar', cities: ['Muscat', 'Salalah'] },
  { iso: 'JO', name: 'Jordan', primary_language: 'ar', cities: ['Amman', 'Aqaba'] },
  { iso: 'LB', name: 'Lebanon', primary_language: 'ar', cities: ['Beirut', 'Tripoli-LB'] },
  { iso: 'SY', name: 'Syria', primary_language: 'ar', cities: ['Damascus', 'Aleppo'] },
  { iso: 'IQ', name: 'Iraq', primary_language: 'ar', cities: ['Baghdad', 'Basra', 'Mosul', 'Erbil'] },
  { iso: 'IR', name: 'Iran', is_tier_1: true, primary_language: 'fa',
    cities: ['Tehran', 'Mashhad', 'Isfahan', 'Shiraz', 'Tabriz', 'Yazd'] },
  { iso: 'IL', name: 'Israel', primary_language: 'he', cities: ['Tel Aviv', 'Jerusalem', 'Haifa', 'Eilat'] },
  { iso: 'PS', name: 'Palestine', primary_language: 'ar', cities: ['Ramallah', 'Gaza', 'Bethlehem'] },
  { iso: 'TR', name: 'Turkey', is_tier_1: true, primary_language: 'tr',
    cities: ['Istanbul', 'Ankara', 'Izmir', 'Antalya', 'Bursa', 'Cappadocia'] },
  { iso: 'YE', name: 'Yemen', primary_language: 'ar', cities: ['Sanaa', 'Aden'] },

  // ---------- North Africa ----------
  { iso: 'EG', name: 'Egypt', is_tier_1: true, primary_language: 'ar',
    cities: ['Cairo', 'Alexandria', 'Giza', 'Luxor', 'Sharm El Sheikh'] },
  { iso: 'MA', name: 'Morocco', primary_language: 'ar', cities: ['Casablanca', 'Marrakech', 'Rabat', 'Fez', 'Tangier'] },
  { iso: 'TN', name: 'Tunisia', primary_language: 'ar', cities: ['Tunis', 'Sfax'] },
  { iso: 'DZ', name: 'Algeria', primary_language: 'ar', cities: ['Algiers', 'Oran'] },
  { iso: 'LY', name: 'Libya', primary_language: 'ar', cities: ['Tripoli-LY', 'Benghazi'] },

  // ---------- Sub-Saharan Africa ----------
  { iso: 'ZA', name: 'South Africa', is_tier_1: true, primary_language: 'en',
    cities: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth', 'Bloemfontein'] },
  { iso: 'NG', name: 'Nigeria', is_tier_1: true, primary_language: 'en',
    cities: ['Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt', 'Benin City'] },
  { iso: 'KE', name: 'Kenya', is_tier_1: true, primary_language: 'sw',
    cities: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru'] },
  { iso: 'ET', name: 'Ethiopia', primary_language: 'am', cities: ['Addis Ababa', 'Dire Dawa'] },
  { iso: 'GH', name: 'Ghana', primary_language: 'en', cities: ['Accra', 'Kumasi', 'Tamale'] },
  { iso: 'TZ', name: 'Tanzania', primary_language: 'sw', cities: ['Dar es Salaam', 'Dodoma', 'Zanzibar', 'Arusha'] },
  { iso: 'UG', name: 'Uganda', primary_language: 'en', cities: ['Kampala', 'Entebbe'] },
  { iso: 'RW', name: 'Rwanda', primary_language: 'rw', cities: ['Kigali'] },
  { iso: 'SN', name: 'Senegal', primary_language: 'fr', cities: ['Dakar'] },
  { iso: 'CI', name: 'Cote dIvoire', primary_language: 'fr', cities: ['Abidjan', 'Yamoussoukro'] },
  { iso: 'CM', name: 'Cameroon', primary_language: 'fr', cities: ['Yaounde', 'Douala'] },
  { iso: 'ZW', name: 'Zimbabwe', primary_language: 'en', cities: ['Harare', 'Bulawayo'] },
  { iso: 'ZM', name: 'Zambia', primary_language: 'en', cities: ['Lusaka'] },
  { iso: 'MZ', name: 'Mozambique', primary_language: 'pt', cities: ['Maputo'] },
  { iso: 'AO', name: 'Angola', primary_language: 'pt', cities: ['Luanda'] },
  { iso: 'BW', name: 'Botswana', primary_language: 'en', cities: ['Gaborone'] },
  { iso: 'NA', name: 'Namibia', primary_language: 'en', cities: ['Windhoek'] },
  { iso: 'MU', name: 'Mauritius', primary_language: 'en', cities: ['Port Louis'] },
  { iso: 'MG', name: 'Madagascar', primary_language: 'fr', cities: ['Antananarivo'] },
  { iso: 'SD', name: 'Sudan', primary_language: 'ar', cities: ['Khartoum'] },
  { iso: 'SS', name: 'South Sudan', primary_language: 'en', cities: ['Juba'] },
  { iso: 'SO', name: 'Somalia', primary_language: 'so', cities: ['Mogadishu'] },
  { iso: 'CD', name: 'DR Congo', primary_language: 'fr', cities: ['Kinshasa', 'Lubumbashi'] },

  // ---------- Europe ----------
  { iso: 'GB', name: 'United Kingdom', is_tier_1: true, primary_language: 'en',
    cities: ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow', 'Liverpool', 'Bristol', 'Leeds', 'Cardiff', 'Belfast', 'Brighton', 'Newcastle', 'Sheffield', 'Oxford', 'Cambridge', 'Nottingham'] },
  { iso: 'IE', name: 'Ireland', primary_language: 'en', cities: ['Dublin', 'Cork', 'Galway', 'Limerick'] },
  { iso: 'FR', name: 'France', is_tier_1: true, primary_language: 'fr',
    cities: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Bordeaux', 'Lille', 'Strasbourg', 'Nantes'] },
  { iso: 'DE', name: 'Germany', is_tier_1: true, primary_language: 'de',
    cities: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart', 'Dusseldorf', 'Leipzig', 'Dresden'] },
  { iso: 'ES', name: 'Spain', is_tier_1: true, primary_language: 'es',
    cities: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Bilbao', 'Malaga', 'Granada', 'Zaragoza'] },
  { iso: 'PT', name: 'Portugal', primary_language: 'pt', cities: ['Lisbon', 'Porto', 'Faro', 'Coimbra'] },
  { iso: 'IT', name: 'Italy', is_tier_1: true, primary_language: 'it',
    cities: ['Rome', 'Milan', 'Florence', 'Naples', 'Turin', 'Bologna', 'Venice', 'Palermo', 'Genoa'] },
  { iso: 'NL', name: 'Netherlands', is_tier_1: true, primary_language: 'nl',
    cities: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven'] },
  { iso: 'BE', name: 'Belgium', primary_language: 'nl', cities: ['Brussels', 'Antwerp', 'Ghent', 'Bruges'] },
  { iso: 'CH', name: 'Switzerland', primary_language: 'de', cities: ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne'] },
  { iso: 'AT', name: 'Austria', primary_language: 'de', cities: ['Vienna', 'Salzburg', 'Innsbruck', 'Graz'] },
  { iso: 'SE', name: 'Sweden', primary_language: 'sv', cities: ['Stockholm', 'Gothenburg', 'Malmo', 'Uppsala'] },
  { iso: 'NO', name: 'Norway', primary_language: 'no', cities: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger'] },
  { iso: 'DK', name: 'Denmark', primary_language: 'da', cities: ['Copenhagen', 'Aarhus', 'Odense'] },
  { iso: 'FI', name: 'Finland', primary_language: 'fi', cities: ['Helsinki', 'Tampere', 'Turku'] },
  { iso: 'IS', name: 'Iceland', primary_language: 'is', cities: ['Reykjavik'] },
  { iso: 'PL', name: 'Poland', is_tier_1: true, primary_language: 'pl',
    cities: ['Warsaw', 'Krakow', 'Wroclaw', 'Gdansk', 'Poznan', 'Lodz'] },
  { iso: 'CZ', name: 'Czech Republic', primary_language: 'cs', cities: ['Prague', 'Brno', 'Ostrava'] },
  { iso: 'HU', name: 'Hungary', primary_language: 'hu', cities: ['Budapest', 'Debrecen'] },
  { iso: 'RO', name: 'Romania', primary_language: 'ro', cities: ['Bucharest', 'Cluj-Napoca', 'Timisoara', 'Iasi'] },
  { iso: 'BG', name: 'Bulgaria', primary_language: 'bg', cities: ['Sofia', 'Plovdiv', 'Varna'] },
  { iso: 'GR', name: 'Greece', primary_language: 'el', cities: ['Athens', 'Thessaloniki', 'Patras', 'Heraklion'] },
  { iso: 'HR', name: 'Croatia', primary_language: 'hr', cities: ['Zagreb', 'Split', 'Dubrovnik', 'Rijeka'] },
  { iso: 'SI', name: 'Slovenia', primary_language: 'sl', cities: ['Ljubljana'] },
  { iso: 'SK', name: 'Slovakia', primary_language: 'sk', cities: ['Bratislava'] },
  { iso: 'EE', name: 'Estonia', primary_language: 'et', cities: ['Tallinn'] },
  { iso: 'LV', name: 'Latvia', primary_language: 'lv', cities: ['Riga'] },
  { iso: 'LT', name: 'Lithuania', primary_language: 'lt', cities: ['Vilnius', 'Kaunas'] },
  { iso: 'UA', name: 'Ukraine', primary_language: 'uk', cities: ['Kyiv', 'Lviv', 'Odessa', 'Kharkiv'] },
  { iso: 'RU', name: 'Russia', is_tier_1: true, primary_language: 'ru',
    cities: ['Moscow', 'St. Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Kazan', 'Sochi'] },
  { iso: 'BY', name: 'Belarus', primary_language: 'be', cities: ['Minsk'] },
  { iso: 'MD', name: 'Moldova', primary_language: 'ro', cities: ['Chisinau'] },
  { iso: 'RS', name: 'Serbia', primary_language: 'sr', cities: ['Belgrade', 'Novi Sad'] },
  { iso: 'AL', name: 'Albania', primary_language: 'sq', cities: ['Tirana'] },
  { iso: 'MK', name: 'North Macedonia', primary_language: 'mk', cities: ['Skopje'] },
  { iso: 'BA', name: 'Bosnia & Herzegovina', primary_language: 'bs', cities: ['Sarajevo'] },
  { iso: 'ME', name: 'Montenegro', primary_language: 'sr', cities: ['Podgorica'] },
  { iso: 'CY', name: 'Cyprus', primary_language: 'el', cities: ['Nicosia', 'Limassol'] },
  { iso: 'MT', name: 'Malta', primary_language: 'mt', cities: ['Valletta'] },
  { iso: 'LU', name: 'Luxembourg', primary_language: 'fr', cities: ['Luxembourg City'] },

  // ---------- North America ----------
  { iso: 'US', name: 'United States', is_tier_1: true, primary_language: 'en',
    states: ['California', 'Texas', 'New York', 'Florida', 'Illinois', 'Pennsylvania', 'Ohio', 'Georgia', 'North Carolina', 'Michigan', 'New Jersey', 'Virginia', 'Washington', 'Arizona', 'Massachusetts', 'Tennessee', 'Indiana', 'Maryland', 'Missouri', 'Wisconsin', 'Colorado', 'Minnesota', 'South Carolina', 'Alabama', 'Louisiana', 'Kentucky', 'Oregon', 'Oklahoma', 'Connecticut', 'Utah', 'Iowa', 'Nevada', 'Arkansas', 'Mississippi', 'Kansas', 'New Mexico', 'Nebraska', 'West Virginia', 'Idaho', 'Hawaii', 'New Hampshire', 'Maine', 'Montana', 'Rhode Island', 'Delaware', 'South Dakota', 'North Dakota', 'Alaska', 'Vermont', 'Wyoming'],
    cities: ['New York City', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin', 'San Jose', 'San Francisco', 'Seattle', 'Denver', 'Boston', 'Atlanta', 'Miami', 'Washington DC', 'Las Vegas', 'Portland', 'Detroit', 'Minneapolis', 'New Orleans', 'Nashville', 'Salt Lake City', 'Pittsburgh', 'Baltimore', 'St. Louis', 'Indianapolis', 'Honolulu', 'Charlotte', 'Tampa', 'Orlando', 'Sacramento', 'Kansas City'] },
  { iso: 'CA', name: 'Canada', is_tier_1: true, primary_language: 'en',
    cities: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton', 'Quebec City', 'Winnipeg', 'Halifax', 'Victoria'] },
  { iso: 'MX', name: 'Mexico', is_tier_1: true, primary_language: 'es',
    cities: ['Mexico City', 'Guadalajara', 'Monterrey', 'Cancun', 'Puebla', 'Tijuana', 'Oaxaca', 'Merida'] },

  // ---------- Central America & Caribbean ----------
  { iso: 'CU', name: 'Cuba', primary_language: 'es', cities: ['Havana'] },
  { iso: 'DO', name: 'Dominican Republic', primary_language: 'es', cities: ['Santo Domingo'] },
  { iso: 'PR', name: 'Puerto Rico', primary_language: 'es', cities: ['San Juan'] },
  { iso: 'JM', name: 'Jamaica', primary_language: 'en', cities: ['Kingston'] },
  { iso: 'TT', name: 'Trinidad & Tobago', primary_language: 'en', cities: ['Port of Spain'] },
  { iso: 'GT', name: 'Guatemala', primary_language: 'es', cities: ['Guatemala City'] },
  { iso: 'CR', name: 'Costa Rica', primary_language: 'es', cities: ['San Jose'] },
  { iso: 'PA', name: 'Panama', primary_language: 'es', cities: ['Panama City'] },
  { iso: 'HN', name: 'Honduras', primary_language: 'es', cities: ['Tegucigalpa'] },
  { iso: 'SV', name: 'El Salvador', primary_language: 'es', cities: ['San Salvador'] },
  { iso: 'NI', name: 'Nicaragua', primary_language: 'es', cities: ['Managua'] },
  { iso: 'HT', name: 'Haiti', primary_language: 'fr', cities: ['Port-au-Prince'] },

  // ---------- South America ----------
  { iso: 'BR', name: 'Brazil', is_tier_1: true, primary_language: 'pt',
    cities: ['Sao Paulo', 'Rio de Janeiro', 'Brasilia', 'Salvador', 'Belo Horizonte', 'Fortaleza', 'Manaus', 'Curitiba', 'Recife', 'Porto Alegre'] },
  { iso: 'AR', name: 'Argentina', is_tier_1: true, primary_language: 'es',
    cities: ['Buenos Aires', 'Cordoba', 'Rosario', 'Mendoza', 'La Plata'] },
  { iso: 'CL', name: 'Chile', primary_language: 'es', cities: ['Santiago', 'Valparaiso', 'Concepcion'] },
  { iso: 'CO', name: 'Colombia', is_tier_1: true, primary_language: 'es',
    cities: ['Bogota', 'Medellin', 'Cali', 'Cartagena', 'Barranquilla'] },
  { iso: 'PE', name: 'Peru', primary_language: 'es', cities: ['Lima', 'Cusco', 'Arequipa'] },
  { iso: 'VE', name: 'Venezuela', primary_language: 'es', cities: ['Caracas', 'Maracaibo'] },
  { iso: 'EC', name: 'Ecuador', primary_language: 'es', cities: ['Quito', 'Guayaquil'] },
  { iso: 'BO', name: 'Bolivia', primary_language: 'es', cities: ['La Paz', 'Santa Cruz'] },
  { iso: 'PY', name: 'Paraguay', primary_language: 'es', cities: ['Asuncion'] },
  { iso: 'UY', name: 'Uruguay', primary_language: 'es', cities: ['Montevideo'] },

  // ---------- Oceania ----------
  { iso: 'AU', name: 'Australia', is_tier_1: true, primary_language: 'en',
    cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra', 'Gold Coast', 'Hobart', 'Darwin', 'Newcastle-AU'] },
  { iso: 'NZ', name: 'New Zealand', primary_language: 'en', cities: ['Auckland', 'Wellington', 'Christchurch', 'Queenstown', 'Dunedin'] },
  { iso: 'FJ', name: 'Fiji', primary_language: 'en', cities: ['Suva'] },
  { iso: 'PG', name: 'Papua New Guinea', primary_language: 'en', cities: ['Port Moresby'] },

  // ---------- Central Asia & Caucasus ----------
  { iso: 'KZ', name: 'Kazakhstan', primary_language: 'kk', cities: ['Almaty', 'Astana'] },
  { iso: 'UZ', name: 'Uzbekistan', primary_language: 'uz', cities: ['Tashkent', 'Samarkand', 'Bukhara'] },
  { iso: 'KG', name: 'Kyrgyzstan', primary_language: 'ky', cities: ['Bishkek'] },
  { iso: 'TJ', name: 'Tajikistan', primary_language: 'tg', cities: ['Dushanbe'] },
  { iso: 'TM', name: 'Turkmenistan', primary_language: 'tk', cities: ['Ashgabat'] },
  { iso: 'AM', name: 'Armenia', primary_language: 'hy', cities: ['Yerevan'] },
  { iso: 'AZ', name: 'Azerbaijan', primary_language: 'az', cities: ['Baku'] },
  { iso: 'GE', name: 'Georgia', primary_language: 'ka', cities: ['Tbilisi', 'Batumi'] },
];

// helper: slugify a string
export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ============================================================================
// PART A — REGIONAL ROOMS (per country, per city)
// ============================================================================

const PER_CITY_BASE: Array<{name: string; topic: string; flags: RoomFlag[]; tags: string[]}> = [
  { name: 'lobby',         topic: '{city}: anyone, anything. The main square.',        flags: ['voice_enabled'], tags: ['general'] },
  { name: 'late-night',    topic: '{city} after midnight. Awake when others sleep.',   flags: ['voice_enabled'], tags: ['night'] },
  { name: 'newcomers',     topic: 'Just moved to {city}. Land here first.',            flags: ['voice_enabled'], tags: ['newcomers'] },
  { name: 'singles',       topic: 'Single in {city}. See where it goes.',              flags: ['voice_enabled'], tags: ['dating', 'singles'] },
  { name: 'queer',         topic: 'Queer-affirming {city} local.',                     flags: ['voice_enabled'], tags: ['queer', 'lgbtq'] },
  { name: 'events',        topic: 'What is happening in {city} this week.',            flags: ['voice_enabled'], tags: ['events'] },
  { name: 'foodies',       topic: 'Where to eat in {city}. What to try.',              flags: ['voice_enabled'], tags: ['food'] },
  { name: 'coworking',     topic: '{city} remote workers, freelancers, hello.',        flags: ['voice_enabled', 'cam_enabled', 'conference_capable'], tags: ['work', 'remote'] },
];

const PER_CITY_TIER1: Array<{name: string; topic: string; flags: RoomFlag[]; tags: string[]}> = [
  { name: 'startup-scene', topic: '{city} founders, makers, money.',                   flags: ['voice_enabled', 'cam_enabled', 'conference_capable'], tags: ['startup'] },
  { name: 'art-scene',     topic: '{city} galleries, openings, makers.',               flags: [], tags: ['art'] },
  { name: 'music-scene',   topic: '{city} gigs, venues, who is playing.',              flags: [], tags: ['music', 'live'] },
  { name: 'parents',       topic: '{city} mums, dads, parents of all kinds.',          flags: [], tags: ['parents'] },
  { name: 'housing',       topic: '{city} rent, flatmates, area gossip.',              flags: [], tags: ['housing'] },
  { name: 'lost-found',    topic: '{city} lost things, found things, missed connections.', flags: [], tags: ['lost-found'] },
  { name: 'traffic-rant',  topic: 'Yell about the {city} commute. Catharsis.',         flags: [], tags: ['rant'] },
  { name: 'weekend-plans', topic: '{city} Fri-Sun coordination.',                      flags: ['voice_enabled'], tags: ['weekend'] },
  { name: 'date-tonight',  topic: 'Looking for someone tonight in {city}.',            flags: ['voice_enabled', 'adult'], tags: ['dating', 'tonight'] },
  { name: 'photographers', topic: '{city} photographers, all genres.',                 flags: [], tags: ['photography'] },
  { name: 'runners',       topic: '{city} runners, parkruns, marathons.',              flags: [], tags: ['running'] },
  { name: 'cyclists',      topic: '{city} cyclists, routes, group rides.',             flags: [], tags: ['cycling'] },
  { name: 'bookclub',      topic: '{city} readers, swap and discuss.',                 flags: ['voice_enabled'], tags: ['books'] },
];

export function generateRegionalRooms(): SeedRoom[] {
  const rooms: SeedRoom[] = [];
  for (const country of COUNTRIES) {
    for (const city of country.cities) {
      const citySlug = slug(city);
      const subSlug = `${country.iso.toLowerCase()}-${citySlug}`;
      const templates = country.is_tier_1 ? [...PER_CITY_BASE, ...PER_CITY_TIER1] : PER_CITY_BASE;
      for (const t of templates) {
        rooms.push({
          category_slug: 'regional',
          subcategory_slug: subSlug,
          name: `${citySlug}-${t.name}`,
          topic: t.topic.replace(/{city}/g, city),
          flags: t.flags,
          capacity: 50,
          tags: [...t.tags, country.iso.toLowerCase(), citySlug],
          language: country.primary_language,
          region: country.iso,
        });
      }
    }
    // country-level rooms
    const cSlug = country.iso.toLowerCase();
    rooms.push(
      { category_slug: 'regional', subcategory_slug: `${cSlug}-national`, name: `${cSlug}-national-lobby`, topic: `${country.name} national lobby.`, flags: ['voice_enabled', 'conference_capable'], capacity: 100, tags: ['national', cSlug], language: country.primary_language, region: country.iso },
      { category_slug: 'regional', subcategory_slug: `${cSlug}-national`, name: `${cSlug}-politics`,       topic: `${country.name} politics, civil.`, flags: [], capacity: 50, tags: ['politics', cSlug], language: country.primary_language, region: country.iso },
      { category_slug: 'regional', subcategory_slug: `${cSlug}-national`, name: `${cSlug}-diaspora`,       topic: `${country.name} folks abroad.`, flags: ['voice_enabled'], capacity: 50, tags: ['diaspora', cSlug], language: country.primary_language, region: country.iso },
      { category_slug: 'regional', subcategory_slug: `${cSlug}-national`, name: `${cSlug}-language-help`,  topic: `Help with ${country.primary_language} language.`, flags: ['voice_enabled'], capacity: 50, tags: ['language', cSlug], language: country.primary_language, region: country.iso },
    );
  }
  return rooms;
}

// ============================================================================
// PART B — ROMANCE & DATING (per country)
// ============================================================================

const ROMANCE_TEMPLATES: Array<{name: string; topic: string; flags: RoomFlag[]; adult?: boolean}> = [
  // Mainstream singles
  { name: 'singles',                     topic: 'Singles in {c}. See what happens.',                flags: ['voice_enabled'] },
  { name: 'singles-20s',                 topic: '20s singles in {c}.',                              flags: ['voice_enabled'] },
  { name: 'singles-30plus',              topic: '30+ singles in {c}.',                              flags: ['voice_enabled'] },
  { name: 'singles-40plus',              topic: '40+ singles in {c}.',                              flags: ['voice_enabled'] },
  { name: 'singles-50plus',              topic: '50+ singles in {c}.',                              flags: ['voice_enabled'] },
  { name: 'singles-60plus',              topic: '60+ singles in {c}.',                              flags: ['voice_enabled'] },
  // Life stage
  { name: 'divorcees-dating-again',      topic: 'Starting over after divorce in {c}.',              flags: [] },
  { name: 'widowed-and-ready',           topic: 'Widowed and considering love again.',              flags: [] },
  { name: 'single-parents-dating',       topic: 'Dating with kids in {c}.',                         flags: [] },
  { name: 'long-distance',               topic: 'Loving from far away.',                            flags: ['voice_enabled', 'cam_enabled', 'conference_capable'] },
  { name: 'interfaith-couples',          topic: 'Different faiths, same life.',                     flags: [] },
  { name: 'intercaste-couples',          topic: 'Different castes, same love.',                     flags: [] },
  { name: 'interracial-couples',         topic: 'Across cultures, building a we.',                  flags: [] },
  { name: 'marriage-curious',            topic: 'Thinking about marriage, talking it out.',         flags: [] },
  { name: 'pre-wedding-jitters',         topic: 'About to get married. Vibes.',                     flags: [] },
  { name: 'happily-coupled',             topic: 'Already partnered, hanging out.',                  flags: [] },
  { name: 'first-relationship',          topic: 'My first real relationship. Help.',                flags: [] },
  // Gender-pairing (mainstream)
  { name: 'men-seeking-women',           topic: 'Men into women, {c}.',                             flags: ['voice_enabled'] },
  { name: 'women-seeking-men',           topic: 'Women into men, {c}.',                             flags: ['voice_enabled'] },
  // Queer pairings (mirrored under LGBTQ too)
  { name: 'gay-men-dating',              topic: 'Gay men dating in {c}.',                           flags: ['voice_enabled'] },
  { name: 'lesbian-dating',              topic: 'Sapphic dating in {c}.',                           flags: ['voice_enabled'] },
  { name: 'bi-pan-dating',               topic: 'Bi and pan singles in {c}.',                       flags: ['voice_enabled'] },
  { name: 'trans-dating',                topic: 'Trans dating, all configurations.',                flags: ['voice_enabled'] },
  { name: 't4t',                         topic: 'Trans4trans. No cis allowed.',                     flags: ['voice_enabled'] },
  { name: 'nonbinary-dating',            topic: 'Non-binary dating in {c}.',                        flags: ['voice_enabled'] },
  { name: 'queer-platonic',              topic: 'Queer friendship, not dating.',                    flags: ['voice_enabled'] },
  { name: 'ace-dating',                  topic: 'Asexual dating in {c}.',                           flags: [] },
  { name: 'aro-friendship',              topic: 'Aromantic, friendship is the goal.',               flags: [] },
  { name: 'demisexual',                  topic: 'Demisexual folks navigating dating.',              flags: [] },
  // Relationship styles
  { name: 'polyamory',                   topic: 'Polyamory in {c}.',                                flags: ['voice_enabled'] },
  { name: 'open-relationships',          topic: 'Ethical non-monogamy.',                            flags: ['voice_enabled'] },
  { name: 'relationship-anarchy',        topic: 'No hierarchies. Your rules.',                      flags: [] },
  { name: 'solo-poly',                   topic: 'Single and poly = solo poly.',                     flags: [] },
  { name: 'monogamish',                  topic: 'Mostly monogamous, sometimes not.',                flags: [] },
  // Specific scenarios
  { name: 'coffee-date-tonight',         topic: 'Coffee date near you, {c}.',                       flags: ['voice_enabled'] },
  { name: 'dinner-date',                 topic: 'Dinner date coordination.',                        flags: ['voice_enabled'] },
  { name: 'concert-buddy',               topic: 'Going to a concert, want company.',                flags: [] },
  { name: 'movie-buddy',                 topic: 'Movie nights, plus one needed.',                   flags: [] },
  { name: 'walking-partner',             topic: 'Just want to walk and talk.',                      flags: [] },
  { name: 'study-date',                  topic: 'Mutual focus, mutual interest.',                   flags: [] },
  // Adult dating
  { name: 'tonight-only',                topic: 'Looking for tonight, {c}.',                        flags: ['voice_enabled', 'cam_enabled', 'adult'], adult: true },
  { name: 'hookups',                     topic: 'Hookups in {c}.',                                  flags: ['voice_enabled', 'cam_enabled', 'adult'], adult: true },
  { name: 'fwb',                         topic: 'Friends with benefits.',                           flags: ['voice_enabled', 'adult'], adult: true },
  { name: 'one-night-only',              topic: 'One-night connections.',                           flags: ['adult'], adult: true },
  { name: 'sugar-arrangements',          topic: 'Sugar dating. Be respectful.',                     flags: ['adult'], adult: true },
  { name: 'mature-dating',               topic: 'Older folks dating, 40+ only, adult.',             flags: ['voice_enabled', 'adult'], adult: true },
  { name: 'married-discreet',            topic: 'Married, looking elsewhere. Honesty matters.',     flags: ['adult'], adult: true },
];

export function generateRomanceRooms(): SeedRoom[] {
  const rooms: SeedRoom[] = [];
  for (const country of COUNTRIES) {
    const cSlug = country.iso.toLowerCase();
    for (const t of ROMANCE_TEMPLATES) {
      rooms.push({
        category_slug: 'romance',
        subcategory_slug: `romance-${cSlug}`,
        name: `${cSlug}-${t.name}`,
        topic: t.topic.replace(/{c}/g, country.name),
        flags: t.flags,
        capacity: 50,
        tags: ['romance', cSlug, ...(t.adult ? ['adult'] : [])],
        language: country.primary_language,
        region: country.iso,
      });
    }
  }
  return rooms;
}

// ============================================================================
// PART C — LGBTQ+ & QUEER (per country, beyond binaries)
// ============================================================================

const LGBTQ_TEMPLATES: Array<{name: string; topic: string; flags: RoomFlag[]}> = [
  // Broad
  { name: 'queer-lobby',          topic: 'All queer folks welcome.',                        flags: ['voice_enabled'] },
  { name: 'queer-newcomers',      topic: 'Just figuring it out. No pressure.',              flags: ['voice_enabled'] },
  { name: 'coming-out',           topic: 'Coming out, in or out of the closet.',            flags: [] },
  { name: 'still-closeted',       topic: 'Closeted and processing. Safe space.',            flags: [] },
  { name: 'queer-elders',         topic: 'Queer 50+. The ones who paved the road.',         flags: ['voice_enabled'] },
  { name: 'queer-youth-18plus',   topic: 'Queer 18-25.',                                    flags: ['voice_enabled'] },
  { name: 'queer-rural',          topic: 'Queer in small towns and rural areas.',           flags: [] },
  // Orientations
  { name: 'gay-men',              topic: 'Gay men, all flavors.',                           flags: ['voice_enabled', 'cam_enabled'] },
  { name: 'lesbians',             topic: 'Sapphic space.',                                  flags: ['voice_enabled', 'cam_enabled'] },
  { name: 'bisexual',             topic: 'Bi+ people. We exist.',                           flags: ['voice_enabled'] },
  { name: 'pansexual',            topic: 'Pan, attracted across all.',                      flags: ['voice_enabled'] },
  { name: 'questioning',          topic: 'Questioning. No labels needed.',                  flags: ['voice_enabled'] },
  { name: 'asexual',              topic: 'Ace spectrum. Demi, gray, all.',                  flags: [] },
  { name: 'aromantic',            topic: 'Aro spectrum.',                                   flags: [] },
  { name: 'queer-omni',           topic: 'Omnisexual / polysexual identities.',             flags: [] },
  // Gender expansiveness (beyond binaries)
  { name: 'trans-men',            topic: 'Trans masc, FTM, transmasc spectrum.',            flags: ['voice_enabled'] },
  { name: 'trans-women',          topic: 'Trans femme, MTF, transfemme spectrum.',          flags: ['voice_enabled'] },
  { name: 'nonbinary',            topic: 'Non-binary in all our forms.',                    flags: ['voice_enabled'] },
  { name: 'genderfluid',          topic: 'Gender shifts. So do we.',                        flags: ['voice_enabled'] },
  { name: 'agender',              topic: 'Without gender. Or beyond it.',                   flags: [] },
  { name: 'genderqueer',          topic: 'Queer in gender, fluid in form.',                 flags: [] },
  { name: 'bigender',             topic: 'Two genders, sometimes both.',                    flags: [] },
  { name: 'two-spirit',           topic: 'Two-Spirit. Indigenous queer.',                   flags: [] },
  { name: 'demigender',           topic: 'Partly one gender, partly other.',                flags: [] },
  { name: 'xenogender',           topic: 'Beyond the usual maps of gender.',                flags: [] },
  { name: 'intersex',             topic: 'Intersex folks. We exist. We deserve.',           flags: [] },
  { name: 'third-gender',         topic: 'Hijra, Kothi, Kinnar, Aravani, third gender.',    flags: ['voice_enabled'] },
  { name: 'drag-artists',         topic: 'Drag queens, kings, things.',                     flags: ['voice_enabled', 'cam_enabled'] },
  { name: 'cross-dressers',       topic: 'CDs and gender-expressive folks.',                flags: [] },
  // Intersections
  { name: 'queer-disabled',       topic: 'Queer plus disabled. Both whole.',                flags: [] },
  { name: 'queer-neurodivergent', topic: 'Queer plus ND. Autistic, ADHD, all.',             flags: [] },
  { name: 'queer-fat',            topic: 'Queer and fat. Body proud.',                      flags: [] },
  { name: 'queer-parents',        topic: 'Queer parents, all paths to family.',             flags: [] },
  { name: 'queer-ttc',            topic: 'TTC, queer edition.',                             flags: [] },
  { name: 'queer-adoption',       topic: 'Adopting as queer parents.',                      flags: [] },
  { name: 'queer-religious',      topic: 'Queer and religious. All faiths.',                flags: [] },
  { name: 'queer-ex-religious',   topic: 'Left a faith. Still healing.',                    flags: [] },
  { name: 'queer-poc',            topic: 'Queer people of color space.',                    flags: ['voice_enabled'] },
  // Adult / sex-positive queer
  { name: 'queer-adult-lounge',   topic: '🔞 Queer adult chat. Anything goes.',             flags: ['voice_enabled', 'cam_enabled', 'adult'] },
  { name: 'queer-cam',            topic: '🔞 Queer cam, mutual or solo.',                    flags: ['cam_enabled', 'adult', 'nsfw_uploads_allowed'] },
  { name: 'queer-kink',           topic: '🔞 Queer kink community.',                         flags: ['voice_enabled', 'adult'] },
  { name: 'leather-community',    topic: '🔞 Leather, kink, queer.',                         flags: ['adult'] },
  { name: 'bears-otters-cubs',    topic: '🔞 Bears, otters, cubs, chasers.',                 flags: ['voice_enabled', 'cam_enabled', 'adult'] },
  { name: 'twinks-twunks',        topic: '🔞 Twinks, twunks, admirers.',                     flags: ['voice_enabled', 'cam_enabled', 'adult'] },
  { name: 'femmes-butches',       topic: '🔞 Sapphic butch/femme dynamics.',                 flags: ['voice_enabled', 'adult'] },
  { name: 'stone-soft',           topic: '🔞 Stone tops, soft bottoms, all dynamics.',       flags: ['adult'] },
];

export function generateLGBTQRooms(): SeedRoom[] {
  const rooms: SeedRoom[] = [];
  for (const country of COUNTRIES) {
    const cSlug = country.iso.toLowerCase();
    for (const t of LGBTQ_TEMPLATES) {
      rooms.push({
        category_slug: 'lgbtq',
        subcategory_slug: `lgbtq-${cSlug}`,
        name: `${cSlug}-${t.name}`,
        topic: t.topic,
        flags: t.flags,
        capacity: 50,
        tags: ['lgbtq', cSlug],
        language: country.primary_language,
        region: country.iso,
      });
    }
  }
  return rooms;
}


// ============================================================================
// PART D — ADULT & SEX-POSITIVE (global, all 🔞)
// ============================================================================

export const ADULT_GLOBAL_ROOMS: SeedRoom[] = [
  // Flirt & vanilla adult
  { category_slug: 'adult', subcategory_slug: 'adult-flirt', name: 'flirt-lounge', topic: '🔞 Flirt with strangers, mutually consenting.', flags: ['voice_enabled', 'cam_enabled', 'adult'], capacity: 50, tags: ['flirt'] },
  { category_slug: 'adult', subcategory_slug: 'adult-flirt', name: 'after-dark', topic: '🔞 Adults only, after midnight.', flags: ['voice_enabled', 'adult'], capacity: 50, tags: ['late-night'] },
  { category_slug: 'adult', subcategory_slug: 'adult-flirt', name: 'sext-lounge', topic: '🔞 Sext chat, mutual, consensual.', flags: ['adult', 'nsfw_uploads_allowed'], capacity: 30, tags: ['sext'] },
  { category_slug: 'adult', subcategory_slug: 'adult-flirt', name: 'voice-flirt', topic: '🔞 Voice-only flirty chat.', flags: ['voice_enabled', 'adult'], capacity: 25, tags: ['voice', 'flirt'] },
  { category_slug: 'adult', subcategory_slug: 'adult-flirt', name: 'whisper-lounge', topic: '🔞 Whisper-mode adult chat.', flags: ['whisper_only', 'adult'], capacity: 50, tags: ['whisper'] },
  // Cam & broadcast
  { category_slug: 'adult', subcategory_slug: 'adult-cam', name: 'solo-shows', topic: '🔞 Solo cam broadcasts.', flags: ['cam_enabled', 'voice_enabled', 'adult', 'nsfw_uploads_allowed'], capacity: 50, tags: ['cam', 'solo'] },
  { category_slug: 'adult', subcategory_slug: 'adult-cam', name: 'couples-shows', topic: '🔞 Couples on cam.', flags: ['cam_enabled', 'voice_enabled', 'adult', 'nsfw_uploads_allowed'], capacity: 50, tags: ['cam', 'couples'] },
  { category_slug: 'adult', subcategory_slug: 'adult-cam', name: 'group-cam', topic: '🔞 Multi-person cam rooms.', flags: ['cam_enabled', 'voice_enabled', 'adult', 'nsfw_uploads_allowed'], capacity: 25, tags: ['cam', 'group'] },
  { category_slug: 'adult', subcategory_slug: 'adult-cam', name: 'voyeur-lounge', topic: '🔞 Voyeurism, with consent.', flags: ['cam_enabled', 'adult'], capacity: 50, tags: ['voyeur'] },
  { category_slug: 'adult', subcategory_slug: 'adult-cam', name: 'exhibitionist', topic: '🔞 Exhibitionists, mutual consent.', flags: ['cam_enabled', 'voice_enabled', 'adult', 'nsfw_uploads_allowed'], capacity: 50, tags: ['exhibitionist'] },
  // Relationship configurations
  { category_slug: 'adult', subcategory_slug: 'adult-styles', name: 'cuckold', topic: '🔞 Cuckold lifestyle.', flags: ['adult'], capacity: 50, tags: ['cuckold'] },
  { category_slug: 'adult', subcategory_slug: 'adult-styles', name: 'hotwife', topic: '🔞 Hotwife lifestyle.', flags: ['adult'], capacity: 50, tags: ['hotwife'] },
  { category_slug: 'adult', subcategory_slug: 'adult-styles', name: 'swingers', topic: '🔞 Swingers community.', flags: ['voice_enabled', 'adult'], capacity: 50, tags: ['swingers'] },
  { category_slug: 'adult', subcategory_slug: 'adult-styles', name: 'open-marriages', topic: '🔞 Open marriages, honest talk.', flags: ['voice_enabled', 'adult'], capacity: 50, tags: ['open'] },
  { category_slug: 'adult', subcategory_slug: 'adult-styles', name: 'group-experiences', topic: '🔞 Group, threesome, more.', flags: ['adult'], capacity: 50, tags: ['group'] },
  { category_slug: 'adult', subcategory_slug: 'adult-styles', name: 'polyamory-adult', topic: '🔞 Poly people, adult talk.', flags: ['voice_enabled', 'adult'], capacity: 50, tags: ['polyamory'] },
  // Kink & BDSM
  { category_slug: 'adult', subcategory_slug: 'adult-kink', name: 'kink-101', topic: '🔞 New to kink. Curious.', flags: ['voice_enabled', 'adult'], capacity: 50, tags: ['kink', 'beginner'] },
  { category_slug: 'adult', subcategory_slug: 'adult-kink', name: 'bdsm-general', topic: '🔞 BDSM, general.', flags: ['voice_enabled', 'adult'], capacity: 50, tags: ['bdsm'] },
  { category_slug: 'adult', subcategory_slug: 'adult-kink', name: 'dominants', topic: '🔞 Doms, dommes, dominants.', flags: ['voice_enabled', 'adult'], capacity: 50, tags: ['dom'] },
  { category_slug: 'adult', subcategory_slug: 'adult-kink', name: 'submissives', topic: '🔞 Subs, all expressions.', flags: ['voice_enabled', 'adult'], capacity: 50, tags: ['sub'] },
  { category_slug: 'adult', subcategory_slug: 'adult-kink', name: 'switches', topic: '🔞 Switches, both sides.', flags: ['voice_enabled', 'adult'], capacity: 50, tags: ['switch'] },
  { category_slug: 'adult', subcategory_slug: 'adult-kink', name: 'rope-shibari', topic: '🔞 Rope, shibari, bondage.', flags: ['adult'], capacity: 50, tags: ['rope'] },
  { category_slug: 'adult', subcategory_slug: 'adult-kink', name: 'impact-play', topic: '🔞 Impact play, spanking, paddles.', flags: ['adult'], capacity: 50, tags: ['impact'] },
  { category_slug: 'adult', subcategory_slug: 'adult-kink', name: 'sensation-play', topic: '🔞 Wax, ice, sensation.', flags: ['adult'], capacity: 50, tags: ['sensation'] },
  { category_slug: 'adult', subcategory_slug: 'adult-kink', name: 'praise-kink', topic: '🔞 Praise as kink.', flags: ['adult'], capacity: 50, tags: ['praise'] },
  { category_slug: 'adult', subcategory_slug: 'adult-kink', name: 'degradation-kink', topic: '🔞 Consensual degradation play.', flags: ['adult'], capacity: 50, tags: ['degradation'] },
  { category_slug: 'adult', subcategory_slug: 'adult-kink', name: 'daddy-mommy-dom', topic: '🔞 DDLG, MDLG, CGL dynamics.', flags: ['adult'], capacity: 50, tags: ['ddlg'] },
  { category_slug: 'adult', subcategory_slug: 'adult-kink', name: 'pet-play', topic: '🔞 Pet play, owners and pets.', flags: ['adult'], capacity: 50, tags: ['petplay'] },
  { category_slug: 'adult', subcategory_slug: 'adult-kink', name: 'cnc-talk', topic: '🔞 Consensual non-consent discussion.', flags: ['adult'], capacity: 50, tags: ['cnc'] },
  { category_slug: 'adult', subcategory_slug: 'adult-kink', name: 'feet', topic: '🔞 Foot kink, community.', flags: ['adult', 'nsfw_uploads_allowed'], capacity: 50, tags: ['feet'] },
  { category_slug: 'adult', subcategory_slug: 'adult-kink', name: 'chastity', topic: '🔞 Chastity play and lifestyle.', flags: ['adult'], capacity: 50, tags: ['chastity'] },
  { category_slug: 'adult', subcategory_slug: 'adult-kink', name: 'tease-denial', topic: '🔞 Tease and denial.', flags: ['adult'], capacity: 50, tags: ['tease'] },
  // Roleplay & fantasy
  { category_slug: 'adult', subcategory_slug: 'adult-roleplay', name: 'roleplay-scenarios', topic: '🔞 Roleplay scenarios, adult.', flags: ['voice_enabled', 'adult'], capacity: 50, tags: ['roleplay'] },
  { category_slug: 'adult', subcategory_slug: 'adult-roleplay', name: 'erotic-writing', topic: '🔞 Erotic stories and writing.', flags: ['adult'], capacity: 50, tags: ['erotica'] },
  { category_slug: 'adult', subcategory_slug: 'adult-roleplay', name: 'fantasy-sharing', topic: '🔞 Share a fantasy. No judgment.', flags: ['adult'], capacity: 50, tags: ['fantasy'] },
  // Body / type focused
  { category_slug: 'adult', subcategory_slug: 'adult-bodies', name: 'bbw-bhm', topic: '🔞 BBW, BHM, big beautiful folks.', flags: ['voice_enabled', 'cam_enabled', 'adult'], capacity: 50, tags: ['bbw'] },
  { category_slug: 'adult', subcategory_slug: 'adult-bodies', name: 'mature-milf', topic: '🔞 Mature, MILF, 35+ adult.', flags: ['voice_enabled', 'cam_enabled', 'adult'], capacity: 50, tags: ['mature'] },
  { category_slug: 'adult', subcategory_slug: 'adult-bodies', name: 'gilf-mature-men', topic: '🔞 Older men, daddies, mature.', flags: ['voice_enabled', 'cam_enabled', 'adult'], capacity: 50, tags: ['mature-men'] },
  { category_slug: 'adult', subcategory_slug: 'adult-bodies', name: 'amateurs', topic: '🔞 Amateur, real, unfiltered.', flags: ['cam_enabled', 'adult', 'nsfw_uploads_allowed'], capacity: 50, tags: ['amateur'] },
  // Anonymous & confessions
  { category_slug: 'adult', subcategory_slug: 'adult-anon', name: 'adult-confessions', topic: '🔞 Anonymous adult confessions.', flags: ['anonymous_only', 'adult'], capacity: 50, tags: ['confession'] },
  { category_slug: 'adult', subcategory_slug: 'adult-anon', name: 'first-time-stories', topic: '🔞 First time stories, anonymous.', flags: ['anonymous_only', 'adult'], capacity: 50, tags: ['stories'] },
  { category_slug: 'adult', subcategory_slug: 'adult-anon', name: 'cheating-confessions', topic: '🔞 Cheating confessions, no judgment.', flags: ['anonymous_only', 'adult'], capacity: 50, tags: ['confession'] },
  // Sex worker community
  { category_slug: 'adult', subcategory_slug: 'adult-community', name: 'sex-workers-peer', topic: '🔞 Sex workers, peer support and community.', flags: ['adult'], capacity: 50, tags: ['sex-work', 'community'] },
  { category_slug: 'adult', subcategory_slug: 'adult-community', name: 'cam-performers', topic: '🔞 Cam performers, business and craft.', flags: ['voice_enabled', 'adult'], capacity: 50, tags: ['cam-work'] },
  { category_slug: 'adult', subcategory_slug: 'adult-community', name: 'onlyfans-creators', topic: '🔞 OF and similar creators.', flags: ['voice_enabled', 'adult'], capacity: 50, tags: ['creator'] },
];

// ============================================================================
// PART E — IDENTITY & COMMUNITY (global, beyond binaries)
// ============================================================================

export const IDENTITY_ROOMS: SeedRoom[] = [
  // Gender expansiveness
  { category_slug: 'identity', subcategory_slug: 'gender-expansive', name: 'gender-expansive-lobby', topic: 'Everyone whose gender is bigger than the form.', flags: ['voice_enabled'], capacity: 50, tags: ['gender'] },
  { category_slug: 'identity', subcategory_slug: 'gender-expansive', name: 'questioning-gender', topic: 'Just starting to wonder.', flags: [], capacity: 50, tags: ['questioning'] },
  { category_slug: 'identity', subcategory_slug: 'gender-expansive', name: 'detransitioners', topic: 'Detransitioned or de-prioritizing transition. Held with care.', flags: [], capacity: 50, tags: ['detrans'] },
  { category_slug: 'identity', subcategory_slug: 'gender-expansive', name: 'gender-fluid-everyday', topic: 'Living gender fluidly day to day.', flags: [], capacity: 50, tags: ['fluid'] },
  // Body diversity
  { category_slug: 'identity', subcategory_slug: 'body-diverse', name: 'intersex-lounge', topic: 'Intersex folks. All variations.', flags: ['voice_enabled'], capacity: 50, tags: ['intersex'] },
  { category_slug: 'identity', subcategory_slug: 'body-diverse', name: 'disabled-and-proud', topic: 'Disability pride. Crip joy.', flags: ['voice_enabled'], capacity: 50, tags: ['disabled'] },
  { category_slug: 'identity', subcategory_slug: 'body-diverse', name: 'chronic-illness', topic: 'Living with chronic illness.', flags: [], capacity: 50, tags: ['chronic-illness'] },
  { category_slug: 'identity', subcategory_slug: 'body-diverse', name: 'invisible-illness', topic: 'Illness no one can see.', flags: [], capacity: 50, tags: ['invisible-illness'] },
  { category_slug: 'identity', subcategory_slug: 'body-diverse', name: 'fat-positive', topic: 'Fat liberation. Body neutrality.', flags: [], capacity: 50, tags: ['fat-positive'] },
  { category_slug: 'identity', subcategory_slug: 'body-diverse', name: 'neurodivergent-adults', topic: 'Autism, ADHD, dyslexia, all.', flags: ['voice_enabled'], capacity: 50, tags: ['neurodivergent'] },
  { category_slug: 'identity', subcategory_slug: 'body-diverse', name: 'late-diagnosed-nd', topic: 'Diagnosed ND as an adult.', flags: [], capacity: 50, tags: ['neurodivergent', 'late-diagnosed'] },
  { category_slug: 'identity', subcategory_slug: 'body-diverse', name: 'deaf-hoh', topic: 'Deaf and hard of hearing.', flags: [], capacity: 50, tags: ['deaf'] },
  { category_slug: 'identity', subcategory_slug: 'body-diverse', name: 'blind-low-vision', topic: 'Blind and low-vision folks.', flags: ['voice_enabled'], capacity: 50, tags: ['blind'] },
  // Race & ethnicity
  { category_slug: 'identity', subcategory_slug: 'race-ethnicity', name: 'mixed-race', topic: 'Mixed-race, multiracial, third-culture.', flags: ['voice_enabled'], capacity: 50, tags: ['mixed-race'] },
  { category_slug: 'identity', subcategory_slug: 'race-ethnicity', name: 'black-diaspora', topic: 'Black folks globally.', flags: ['voice_enabled'], capacity: 50, tags: ['black'] },
  { category_slug: 'identity', subcategory_slug: 'race-ethnicity', name: 'south-asian-diaspora', topic: 'South Asians abroad.', flags: ['voice_enabled'], capacity: 50, tags: ['south-asian'] },
  { category_slug: 'identity', subcategory_slug: 'race-ethnicity', name: 'east-asian-diaspora', topic: 'East Asians abroad.', flags: ['voice_enabled'], capacity: 50, tags: ['east-asian'] },
  { category_slug: 'identity', subcategory_slug: 'race-ethnicity', name: 'southeast-asian-diaspora', topic: 'SE Asians abroad.', flags: ['voice_enabled'], capacity: 50, tags: ['se-asian'] },
  { category_slug: 'identity', subcategory_slug: 'race-ethnicity', name: 'latine-latinx', topic: 'Latine/Latinx folks.', flags: ['voice_enabled'], capacity: 50, tags: ['latine'] },
  { category_slug: 'identity', subcategory_slug: 'race-ethnicity', name: 'arab-mena', topic: 'Arab and MENA folks.', flags: ['voice_enabled'], capacity: 50, tags: ['arab', 'mena'] },
  { category_slug: 'identity', subcategory_slug: 'race-ethnicity', name: 'indigenous-global', topic: 'Indigenous peoples worldwide.', flags: ['voice_enabled'], capacity: 50, tags: ['indigenous'] },
  { category_slug: 'identity', subcategory_slug: 'race-ethnicity', name: 'pacific-islanders', topic: 'Pacific Islander folks.', flags: ['voice_enabled'], capacity: 50, tags: ['pacific'] },
  { category_slug: 'identity', subcategory_slug: 'race-ethnicity', name: 'roma-romani', topic: 'Roma/Romani community.', flags: [], capacity: 50, tags: ['roma'] },
  { category_slug: 'identity', subcategory_slug: 'race-ethnicity', name: 'jewish-diaspora', topic: 'Jewish folks globally.', flags: ['voice_enabled'], capacity: 50, tags: ['jewish'] },
  // Class & circumstance
  { category_slug: 'identity', subcategory_slug: 'class-circumstance', name: 'first-gen-everything', topic: 'First in family to do X.', flags: ['voice_enabled'], capacity: 50, tags: ['first-gen'] },
  { category_slug: 'identity', subcategory_slug: 'class-circumstance', name: 'working-class-pride', topic: 'Working-class roots, working-class joy.', flags: [], capacity: 50, tags: ['working-class'] },
  { category_slug: 'identity', subcategory_slug: 'class-circumstance', name: 'dalit-bahujan-adivasi', topic: 'Dalit, Bahujan, Adivasi folks.', flags: ['voice_enabled'], capacity: 50, tags: ['dalit', 'bahujan', 'adivasi'] },
  { category_slug: 'identity', subcategory_slug: 'class-circumstance', name: 'caste-conversations', topic: 'Caste in 2026. Hard conversations.', flags: [], capacity: 50, tags: ['caste'] },
  { category_slug: 'identity', subcategory_slug: 'class-circumstance', name: 'refugees-displaced', topic: 'Refugees, displaced, asylum seekers.', flags: [], capacity: 50, tags: ['refugee'] },
  { category_slug: 'identity', subcategory_slug: 'class-circumstance', name: 'immigrants', topic: 'Immigrants worldwide.', flags: ['voice_enabled'], capacity: 50, tags: ['immigrant'] },
  { category_slug: 'identity', subcategory_slug: 'class-circumstance', name: 'formerly-incarcerated', topic: 'Reentering after incarceration.', flags: [], capacity: 50, tags: ['reentry'] },
  { category_slug: 'identity', subcategory_slug: 'class-circumstance', name: 'unhoused-formerly', topic: 'Currently or formerly unhoused.', flags: [], capacity: 50, tags: ['unhoused'] },
  // Survivor & support (with crisis card)
  { category_slug: 'identity', subcategory_slug: 'survivors', name: 'survivors-sa', topic: 'Survivors of sexual violence. Peer support.', flags: ['crisis_card_pinned'], capacity: 50, tags: ['survivor', 'sa'] },
  { category_slug: 'identity', subcategory_slug: 'survivors', name: 'survivors-dv', topic: 'Survivors of domestic violence.', flags: ['crisis_card_pinned'], capacity: 50, tags: ['survivor', 'dv'] },
  { category_slug: 'identity', subcategory_slug: 'survivors', name: 'religious-trauma', topic: 'Religious trauma, cult recovery.', flags: [], capacity: 50, tags: ['survivor', 'religion'] },
  { category_slug: 'identity', subcategory_slug: 'survivors', name: 'survivors-csa', topic: 'CSA survivors. Adult-only. Strict care.', flags: ['crisis_card_pinned'], capacity: 50, tags: ['survivor', 'csa'] },
  { category_slug: 'identity', subcategory_slug: 'survivors', name: 'survivors-grooming', topic: 'Survivors of grooming.', flags: ['crisis_card_pinned'], capacity: 50, tags: ['survivor', 'grooming'] },
  // Family structures
  { category_slug: 'identity', subcategory_slug: 'family-structures', name: 'eldest-daughters', topic: 'Eldest daughters of immigrant families.', flags: ['voice_enabled'], capacity: 50, tags: ['family'] },
  { category_slug: 'identity', subcategory_slug: 'family-structures', name: 'eldest-sons', topic: 'Eldest sons, all the weight.', flags: [], capacity: 50, tags: ['family'] },
  { category_slug: 'identity', subcategory_slug: 'family-structures', name: 'only-children', topic: 'Only children, only.', flags: [], capacity: 50, tags: ['family'] },
  { category_slug: 'identity', subcategory_slug: 'family-structures', name: 'middle-children', topic: 'Middle children, middle vibes.', flags: [], capacity: 50, tags: ['family'] },
  { category_slug: 'identity', subcategory_slug: 'family-structures', name: 'twins', topic: 'Twins, all configurations.', flags: [], capacity: 50, tags: ['family'] },
  { category_slug: 'identity', subcategory_slug: 'family-structures', name: 'adopted', topic: 'Adopted people, all paths.', flags: [], capacity: 50, tags: ['family', 'adopted'] },
  { category_slug: 'identity', subcategory_slug: 'family-structures', name: 'step-families', topic: 'Step-family dynamics.', flags: [], capacity: 50, tags: ['family'] },
  { category_slug: 'identity', subcategory_slug: 'family-structures', name: 'kids-of-divorce', topic: 'Kids of divorce, adult now.', flags: [], capacity: 50, tags: ['family'] },
  { category_slug: 'identity', subcategory_slug: 'family-structures', name: 'kids-of-immigrants', topic: 'Children of immigrant parents.', flags: ['voice_enabled'], capacity: 50, tags: ['family'] },
  { category_slug: 'identity', subcategory_slug: 'family-structures', name: 'estranged-from-family', topic: 'No contact, low contact, complicated.', flags: [], capacity: 50, tags: ['family', 'estranged'] },
];


// ============================================================================
// PART F — STUDENTS GLOBAL
// ============================================================================

const STUDENT_EXAMS = [
  // India
  'jee-main', 'jee-advanced', 'neet', 'cat', 'mat', 'xat', 'gate', 'upsc',
  'tnpsc', 'kpsc', 'mpsc', 'bpsc', 'uppcs', 'ssc-cgl', 'ibps', 'sbi-po', 'rbi-grade-b',
  'ca-foundation', 'ca-inter', 'ca-final', 'icsi', 'icmai', 'nda', 'cds',
  'jee-tn', 'kcet', 'mhcet', 'comedk', 'bits-pilani',
  'nift', 'nid', 'ceed',
  // Global
  'gre', 'gmat', 'toefl', 'ielts', 'duolingo-english', 'pte',
  'sat', 'act', 'lsat', 'clat', 'mcat', 'usmle', 'plab', 'amc', 'enarm',
  'cfa', 'frm', 'cpa', 'cma',
];

const STUDENT_INSTITUTIONS = [
  // IITs
  'iit-madras', 'iit-bombay', 'iit-delhi', 'iit-kanpur', 'iit-kharagpur', 'iit-roorkee', 'iit-guwahati', 'iit-hyderabad', 'iit-bhu', 'iit-indore', 'iit-mandi', 'iit-jodhpur', 'iit-patna', 'iit-bhilai',
  // IIMs
  'iim-ahmedabad', 'iim-bangalore', 'iim-calcutta', 'iim-lucknow', 'iim-indore', 'iim-kozhikode', 'iim-shillong', 'iim-rohtak', 'iim-udaipur', 'iim-trichy',
  // Other India
  'iisc', 'iiser-pune', 'iiser-mohali', 'aiims-delhi', 'aiims-jodhpur', 'jipmer', 'cmc-vellore',
  'nit-trichy', 'nit-warangal', 'nit-surathkal', 'nit-rourkela', 'nit-calicut',
  'iiit-hyderabad', 'iiit-delhi', 'iiit-bangalore',
  'bits-pilani-pilani', 'bits-pilani-goa', 'bits-pilani-hyd', 'bits-pilani-dubai',
  'delhi-university', 'jnu', 'jamia-millia', 'amu', 'bhu',
  'nls-bangalore', 'nalsar-hyderabad', 'wbnujs-kolkata',
  'anna-university', 'mit-manipal', 'vit-vellore', 'srm', 'amrita',
  'isb-hyderabad', 'isb-mohali', 'xlri', 'spjimr',
  // US
  'harvard', 'yale', 'princeton', 'columbia', 'penn', 'cornell', 'brown', 'dartmouth',
  'stanford', 'mit', 'cmu', 'caltech',
  'uc-berkeley', 'ucla', 'ucsd', 'ucsb', 'uc-davis', 'uc-irvine',
  'nyu', 'usc', 'u-michigan', 'georgia-tech', 'uiuc', 'ut-austin', 'uw-madison', 'purdue', 'osu',
  'duke', 'northwestern', 'johns-hopkins', 'wash-u', 'rice', 'vanderbilt', 'emory', 'notre-dame',
  // UK
  'oxford', 'cambridge', 'lse', 'imperial', 'ucl', 'kcl', 'edinburgh', 'manchester-uni', 'warwick', 'bristol-uni', 'st-andrews', 'durham',
  // Canada
  'u-of-t', 'ubc', 'mcgill', 'waterloo', 'queens-canada', 'mcmaster',
  // Australia
  'unimelb', 'usyd', 'anu', 'unsw', 'uq', 'monash',
  // Europe
  'eth-zurich', 'epfl', 'tu-munich', 'tu-berlin', 'tu-delft', 'leiden', 'sorbonne', 'ecole-polytechnique', 'bocconi', 'ie-madrid', 'esade',
  // Asia
  'nus', 'ntu-singapore', 'hku', 'cuhk', 'hkust', 'snu-seoul', 'kaist', 'tokyo-uni', 'kyoto-uni', 'tsinghua', 'peking',
];

export const STUDENT_ROOMS: SeedRoom[] = [
  // By level
  { category_slug: 'students', subcategory_slug: 'students-by-level', name: 'high-schoolers-global', topic: 'School students, all countries.', flags: ['voice_enabled'], capacity: 50, tags: ['school'] },
  { category_slug: 'students', subcategory_slug: 'students-by-level', name: 'undergrad-global', topic: 'Undergrads, all majors, global.', flags: ['voice_enabled'], capacity: 100, tags: ['undergrad'] },
  { category_slug: 'students', subcategory_slug: 'students-by-level', name: 'masters-global', topic: 'Master\'s students, global.', flags: ['voice_enabled'], capacity: 50, tags: ['masters'] },
  { category_slug: 'students', subcategory_slug: 'students-by-level', name: 'phd-research', topic: 'PhDs and research scholars.', flags: ['voice_enabled', 'conference_capable'], capacity: 50, tags: ['phd'] },
  { category_slug: 'students', subcategory_slug: 'students-by-level', name: 'postdoc', topic: 'Postdocs of the world.', flags: [], capacity: 50, tags: ['postdoc'] },
  { category_slug: 'students', subcategory_slug: 'students-by-level', name: 'gap-year', topic: 'Gap year, between things.', flags: [], capacity: 50, tags: ['gap'] },
  // Cross-cutting
  { category_slug: 'students', subcategory_slug: 'students-help', name: 'ask-anything', topic: 'Students ask anything. Peers answer.', flags: ['voice_enabled', 'conference_capable'], capacity: 100, tags: ['help'] },
  { category_slug: 'students', subcategory_slug: 'students-help', name: 'find-a-tutor', topic: 'Looking for a tutor in subject X.', flags: ['voice_enabled'], capacity: 50, tags: ['tutoring'] },
  { category_slug: 'students', subcategory_slug: 'students-help', name: 'offer-tutoring', topic: 'I tutor X. Find me.', flags: ['voice_enabled'], capacity: 50, tags: ['tutoring'] },
  { category_slug: 'students', subcategory_slug: 'students-help', name: 'find-a-professor', topic: 'Looking to talk to a prof in field X.', flags: ['voice_enabled', 'conference_capable'], capacity: 50, tags: ['mentor'] },
  { category_slug: 'students', subcategory_slug: 'students-help', name: 'research-collab', topic: 'Looking for research collaborators.', flags: ['voice_enabled', 'conference_capable'], capacity: 50, tags: ['research'] },
  { category_slug: 'students', subcategory_slug: 'students-help', name: 'paper-discussion', topic: 'Discussing recent papers.', flags: ['voice_enabled'], capacity: 50, tags: ['papers'] },
  { category_slug: 'students', subcategory_slug: 'students-help', name: 'thesis-help', topic: 'Thesis writing struggles.', flags: ['voice_enabled'], capacity: 50, tags: ['thesis'] },
  { category_slug: 'students', subcategory_slug: 'students-help', name: 'study-with-me', topic: 'Silent coworking. Pomodoro.', flags: ['voice_enabled', 'cam_enabled'], capacity: 50, tags: ['study'] },
  { category_slug: 'students', subcategory_slug: 'students-help', name: 'study-with-me-3am', topic: '3am study. We\'re all up.', flags: ['voice_enabled', 'cam_enabled'], capacity: 50, tags: ['study', 'night'] },
  { category_slug: 'students', subcategory_slug: 'students-help', name: 'night-before-exam', topic: 'Exam tomorrow. Panic together.', flags: ['voice_enabled'], capacity: 50, tags: ['exam'] },
  { category_slug: 'students', subcategory_slug: 'students-help', name: 'results-day', topic: 'Results out. Cry or celebrate.', flags: ['voice_enabled', 'time_bound'], capacity: 100, tags: ['results'] },
  // Practical
  { category_slug: 'students', subcategory_slug: 'students-practical', name: 'internship-hunt', topic: 'Hunting internships, sharing leads.', flags: ['voice_enabled'], capacity: 50, tags: ['internship'] },
  { category_slug: 'students', subcategory_slug: 'students-practical', name: 'job-from-college', topic: 'First job out of college.', flags: ['voice_enabled'], capacity: 50, tags: ['job'] },
  { category_slug: 'students', subcategory_slug: 'students-practical', name: 'financial-aid', topic: 'Scholarships, loans, aid.', flags: [], capacity: 50, tags: ['aid'] },
  { category_slug: 'students', subcategory_slug: 'students-practical', name: 'on-campus-housing', topic: 'Hostels, dorms, on-campus.', flags: [], capacity: 50, tags: ['housing'] },
  { category_slug: 'students', subcategory_slug: 'students-practical', name: 'off-campus-housing', topic: 'Renting near campus.', flags: [], capacity: 50, tags: ['housing'] },
  { category_slug: 'students', subcategory_slug: 'students-practical', name: 'roommate-finder', topic: 'Looking for a roommate.', flags: [], capacity: 50, tags: ['housing'] },
  { category_slug: 'students', subcategory_slug: 'students-practical', name: 'textbook-exchange', topic: 'Textbook swap and sell.', flags: [], capacity: 50, tags: ['textbooks'] },
  { category_slug: 'students', subcategory_slug: 'students-practical', name: 'notes-sharing', topic: 'Sharing notes, study guides.', flags: [], capacity: 50, tags: ['notes'] },
  // Mental health / community
  { category_slug: 'students', subcategory_slug: 'students-life', name: 'student-mental-health', topic: 'Student mental health peer support.', flags: ['voice_enabled', 'crisis_card_pinned'], capacity: 50, tags: ['mental-health'] },
  { category_slug: 'students', subcategory_slug: 'students-life', name: 'burnout', topic: 'Burnt out. Not alone.', flags: [], capacity: 50, tags: ['burnout'] },
  { category_slug: 'students', subcategory_slug: 'students-life', name: 'imposter-syndrome', topic: 'Feeling like a fraud. We all do.', flags: [], capacity: 50, tags: ['imposter'] },
  { category_slug: 'students', subcategory_slug: 'students-life', name: 'first-gen-students', topic: 'First in family in higher ed.', flags: ['voice_enabled'], capacity: 50, tags: ['first-gen'] },
  { category_slug: 'students', subcategory_slug: 'students-life', name: 'international-students', topic: 'Studying abroad. Global mixer.', flags: ['voice_enabled', 'conference_capable'], capacity: 100, tags: ['international'] },
  { category_slug: 'students', subcategory_slug: 'students-life', name: 'language-exchange', topic: 'Practice languages with native speakers.', flags: ['voice_enabled'], capacity: 50, tags: ['language'] },
  { category_slug: 'students', subcategory_slug: 'students-life', name: 'coming-out-in-college', topic: 'Coming out at university.', flags: [], capacity: 50, tags: ['queer', 'students'] },
  { category_slug: 'students', subcategory_slug: 'students-life', name: 'hackathon-team-finder', topic: 'Find your hackathon team.', flags: ['voice_enabled', 'conference_capable'], capacity: 50, tags: ['hackathon'] },
  { category_slug: 'students', subcategory_slug: 'students-life', name: 'startup-cofounder', topic: 'Looking for a co-founder at uni.', flags: ['voice_enabled', 'conference_capable'], capacity: 50, tags: ['startup'] },
  // Office hours (verified)
  { category_slug: 'students', subcategory_slug: 'office-hours', name: 'prof-office-hours-cs', topic: 'Verified CS profs hold office hours.', flags: ['voice_enabled', 'cam_enabled', 'conference_capable', 'verified_professors_only'], capacity: 50, tags: ['office-hours', 'cs'] },
  { category_slug: 'students', subcategory_slug: 'office-hours', name: 'prof-office-hours-econ', topic: 'Verified econ profs.', flags: ['voice_enabled', 'conference_capable', 'verified_professors_only'], capacity: 50, tags: ['office-hours', 'econ'] },
  { category_slug: 'students', subcategory_slug: 'office-hours', name: 'prof-office-hours-medicine', topic: 'Verified MDs and faculty.', flags: ['voice_enabled', 'conference_capable', 'verified_professors_only'], capacity: 50, tags: ['office-hours', 'medicine'] },
  { category_slug: 'students', subcategory_slug: 'office-hours', name: 'prof-office-hours-law', topic: 'Verified law faculty.', flags: ['voice_enabled', 'conference_capable', 'verified_professors_only'], capacity: 50, tags: ['office-hours', 'law'] },
  { category_slug: 'students', subcategory_slug: 'office-hours', name: 'prof-office-hours-engineering', topic: 'Verified engineering faculty.', flags: ['voice_enabled', 'conference_capable', 'verified_professors_only'], capacity: 50, tags: ['office-hours', 'engineering'] },
  { category_slug: 'students', subcategory_slug: 'office-hours', name: 'prof-office-hours-humanities', topic: 'Verified humanities faculty.', flags: ['voice_enabled', 'conference_capable', 'verified_professors_only'], capacity: 50, tags: ['office-hours', 'humanities'] },
  { category_slug: 'students', subcategory_slug: 'office-hours', name: 'prof-office-hours-arts', topic: 'Verified arts faculty.', flags: ['voice_enabled', 'conference_capable', 'verified_professors_only'], capacity: 50, tags: ['office-hours', 'arts'] },
  { category_slug: 'students', subcategory_slug: 'office-hours', name: 'industry-mentors-ama', topic: 'Industry mentors host AMAs.', flags: ['voice_enabled', 'conference_capable', 'verified_professionals_only'], capacity: 100, tags: ['ama', 'mentor'] },
  { category_slug: 'students', subcategory_slug: 'office-hours', name: 'counselors-students', topic: 'Verified counselors for students.', flags: ['voice_enabled', 'conference_capable', 'verified_professionals_only', 'crisis_card_pinned'], capacity: 30, tags: ['mental-health', 'verified'] },
  // Per institution (top ones)
  ...STUDENT_INSTITUTIONS.map(inst => ({
    category_slug: 'students', subcategory_slug: 'students-by-institution', name: `${inst}-lobby`,
    topic: `${inst.replace(/-/g, ' ')} students and alumni.`,
    flags: ['voice_enabled', 'verified_students_only'] as RoomFlag[],
    capacity: 50, tags: ['institution', inst],
  })),
  // Per exam
  ...STUDENT_EXAMS.map(exam => ({
    category_slug: 'students', subcategory_slug: 'students-by-exam', name: `${exam}-prep`,
    topic: `${exam.toUpperCase().replace(/-/g, ' ')} prep, peer help.`,
    flags: ['voice_enabled'] as RoomFlag[],
    capacity: 100, tags: ['exam', exam],
  })),
];


// ============================================================================
// PART G — CAREER & WORK
// ============================================================================

export const CAREER_ROOMS: SeedRoom[] = [
  // Software
  ...['frontend', 'backend', 'fullstack', 'mobile-ios', 'mobile-android', 'flutter', 'react-native', 'devops', 'sre', 'platform-eng', 'data-eng', 'ml-eng', 'security', 'qa', 'embedded', 'game-dev', 'web3-dev'].map(s => ({
    category_slug: 'career', subcategory_slug: 'career-software', name: `${s}-devs`,
    topic: `${s.replace(/-/g, ' ')} engineers, global.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 100, tags: ['software', s],
  })),
  // Product / design / data
  ...['product-managers', 'product-designers', 'ux-research', 'product-marketing', 'design-systems', 'data-science', 'analytics', 'bi-engineers', 'mlops-engineers'].map(s => ({
    category_slug: 'career', subcategory_slug: 'career-product-design', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 100, tags: ['product', s],
  })),
  // Finance professions
  ...['investment-banking', 'corporate-banking', 'retail-banking', 'equity-research', 'fixed-income', 'fx-trading', 'commodities', 'private-equity', 'venture-capital', 'hedge-funds', 'risk-management', 'compliance', 'audit', 'tax', 'treasury', 'wealth-management', 'family-office'].map(s => ({
    category_slug: 'career', subcategory_slug: 'career-finance', name: s,
    topic: `${s.replace(/-/g, ' ')} pros.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 50, tags: ['finance', s],
  })),
  // Consulting
  ...['strategy-consulting', 'mbb-consultants', 'big-four', 'boutique-consultants', 'operations-consulting'].map(s => ({
    category_slug: 'career', subcategory_slug: 'career-consulting', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['consulting', s],
  })),
  // Legal
  ...['corporate-law', 'litigation', 'ip-law', 'tax-law', 'ma-law', 'criminal-law', 'family-law', 'constitutional-law', 'cyber-law', 'human-rights-law', 'in-house-counsel'].map(s => ({
    category_slug: 'career', subcategory_slug: 'career-legal', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['legal', s],
  })),
  // Medicine
  ...['cardiology', 'orthopedics', 'neurology', 'gynecology', 'pediatrics', 'psychiatry', 'dermatology', 'ent', 'ophthalmology', 'general-surgery', 'anaesthesia', 'radiology', 'pathology', 'icu-intensivists', 'emergency-medicine', 'family-medicine', 'gp', 'dentistry', 'physiotherapy', 'occupational-therapy', 'pharmacology'].map(s => ({
    category_slug: 'career', subcategory_slug: 'career-medicine', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'verified_professionals_only'] as RoomFlag[], capacity: 50, tags: ['medicine', s],
  })),
  // Other professions
  ...['nursing', 'allied-health', 'pharma-industry', 'biotech', 'academia', 'k12-teachers', 'university-faculty', 'edtech-builders', 'marketing-brand', 'marketing-performance', 'marketing-content', 'growth-marketing', 'social-media-managers', 'sales-saas', 'sales-enterprise', 'sales-real-estate', 'sales-automotive', 'sales-insurance', 'hr-people-ops', 'recruiters', 'operations', 'supply-chain', 'manufacturing', 'industrial-eng', 'architects', 'civil-engineers', 'construction', 'real-estate-brokers', 'real-estate-developers', 'journalists', 'long-form-writers', 'tv-producers', 'filmmakers', 'cinematographers', 'editors-film', 'sound-designers', 'colorists', 'screenwriters', 'theater-folks', 'music-industry', 'a-and-r', 'touring-pros', 'producers-music', 'publishing-pros', 'book-editors', 'literary-agents', 'hospitality-hotels', 'restaurateurs', 'baristas', 'sommeliers-pro', 'bartenders-pro', 'pilots', 'cabin-crew', 'atc', 'aviation-ground-ops', 'mro-aviation', 'maritime', 'shipping', 'logistics-pros', 'agriculture-agritech', 'civil-service', 'foreign-service-diplomats', 'defense-armed-forces', 'veterans-lounge', 'police-officers', 'fire-and-ems', 'ngo-staff', 'fundraising-pros', 'politics-and-policy', 'activists', 'union-organizers'].map(s => ({
    category_slug: 'career', subcategory_slug: 'career-other-professions', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['career', s],
  })),
  // Cross-cutting career
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'salary-transparency', topic: 'Anonymous salary sharing by city + role.', flags: ['anonymous_only'], capacity: 100, tags: ['salary'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'negotiation-help', topic: 'Help me negotiate this offer.', flags: ['voice_enabled'], capacity: 50, tags: ['negotiation'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'quit-stories', topic: 'I quit. Here\'s why.', flags: ['voice_enabled'], capacity: 50, tags: ['quit'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'interview-prep', topic: 'Mock interviews, prep.', flags: ['voice_enabled', 'conference_capable'], capacity: 100, tags: ['interview'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'resume-roast', topic: 'Roast my resume gently.', flags: [], capacity: 50, tags: ['resume'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'linkedin-cringe', topic: 'LinkedIn cringe, archive.', flags: [], capacity: 50, tags: ['linkedin'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'boss-rants', topic: 'Rant about your boss.', flags: ['anonymous_only'], capacity: 50, tags: ['rant'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'new-managers', topic: 'New managers helping each other.', flags: ['voice_enabled'], capacity: 50, tags: ['management'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'senior-eng-lounge', topic: 'Senior+ engineers.', flags: ['voice_enabled'], capacity: 50, tags: ['senior'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'women-in-tech', topic: 'Women in tech, global.', flags: ['voice_enabled', 'conference_capable'], capacity: 100, tags: ['women-in-tech'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'women-in-finance', topic: 'Women in finance.', flags: ['voice_enabled'], capacity: 50, tags: ['women'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'women-in-law', topic: 'Women in law.', flags: ['voice_enabled'], capacity: 50, tags: ['women'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'queer-in-tech', topic: 'Queer folks in tech.', flags: ['voice_enabled'], capacity: 50, tags: ['queer'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'queer-in-finance', topic: 'Queer in finance.', flags: [], capacity: 50, tags: ['queer'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'neurodivergent-pros', topic: 'ND professionals.', flags: [], capacity: 50, tags: ['neurodivergent'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'disabled-pros', topic: 'Disabled professionals.', flags: [], capacity: 50, tags: ['disabled'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'career-pivots', topic: 'Mid-career pivots, all directions.', flags: ['voice_enabled'], capacity: 50, tags: ['pivot'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'coming-back-to-work', topic: 'Returning after maternity, illness, sabbatical.', flags: [], capacity: 50, tags: ['return'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'solopreneurs', topic: 'Solo founders, freelancers.', flags: ['voice_enabled', 'conference_capable'], capacity: 100, tags: ['solo'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'freelancers', topic: 'Freelance life, all crafts.', flags: ['voice_enabled'], capacity: 50, tags: ['freelance'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'gig-workers', topic: 'Gig economy workers.', flags: [], capacity: 50, tags: ['gig'] },
  { category_slug: 'career', subcategory_slug: 'career-crosscutting', name: 'unemployed-not-alone', topic: 'Between jobs. Not alone.', flags: ['voice_enabled'], capacity: 50, tags: ['unemployed'] },
];

// ============================================================================
// PART H — MONEY, TRADING, INVESTING
// ============================================================================

export const FINANCE_ROOMS: SeedRoom[] = [
  // Trading
  ...['traders-floor', 'intraday-traders', 'swing-traders', 'positional-traders', 'options-traders', 'options-selling', 'futures-traders', 'forex-traders', 'crypto-traders', 'crypto-defi', 'crypto-memecoins', 'commodities-traders', 'algo-traders', 'mql5-traders', 'pine-script-traders', 'quant-traders', 'prop-firm-traders', 'smc-traders', 'price-action', 'chartists', 'trading-psychology', 'trading-losses-anon', 'traders-3am-asia', 'traders-london-open', 'traders-ny-open', 'live-trades', 'backtest-results'].map(s => ({
    category_slug: 'finance', subcategory_slug: 'finance-trading', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 100, tags: ['trading', s],
  })),
  // Investing
  ...['long-term-investors', 'value-investors', 'growth-investors', 'dividend-investors', 'index-fund-bogleheads', 'mutual-funds', 'mf-sip', 'direct-equity', 'smallcase-investors', 'us-stocks-from-abroad', 'etfs-only', 'bonds-fixed-income', 'reits-invits', 'gold-silver', 'real-estate-investing', 'stressed-assets', 'alternative-investments', 'aif-investors', 'pms-investors', 'angel-investing', 'vc-watchers', 'startup-equity-101', 'esop-questions', 'pre-ipo-investing', 'ipo-grey-market'].map(s => ({
    category_slug: 'finance', subcategory_slug: 'finance-investing', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 50, tags: ['investing', s],
  })),
  // Personal finance
  ...['personal-finance', 'tax-savers', 'nri-tax', 'fire-movement', 'debt-recovery', 'credit-card-points', 'health-insurance', 'term-insurance', 'estate-planning', 'inheritance', 'crypto-tax', 'gst-freelancers', 'pf-pension', 'first-job-first-money', 'budget-planning', 'frugal-living', 'lifestyle-inflation', 'financial-trauma'].map(s => ({
    category_slug: 'finance', subcategory_slug: 'finance-personal', name: s,
    topic: `${s.replace(/-/g, ' ')} talk.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['personal-finance', s],
  })),
  // Business
  ...['bootstrappers', 'vc-backed-founders', 'd2c-founders', 'saas-founders', 'marketplace-founders', 'creators-as-businesses', 'youtubers-monetization', 'streamers-monetization', 'franchise-owners', 'family-business', 'manufacturing-msme', 'agency-owners', 'consultants-private', 'coaching-business'].map(s => ({
    category_slug: 'finance', subcategory_slug: 'finance-business', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 50, tags: ['business', s],
  })),
];

// ============================================================================
// PART I — TRAVEL, TREK, OUTDOORS
// ============================================================================

export const OUTDOORS_ROOMS: SeedRoom[] = [
  // Trekking
  ...['trekkers-global', 'himalayan-treks', 'western-ghats-trails', 'eastern-ghats-trails', 'nilgiris-trekking', 'sahyadris-trekking', 'uttarakhand-treks', 'himachal-treks', 'kashmir-ladakh-treks', 'sikkim-darjeeling-treks', 'meghalaya-trails', 'arunachal-trails', 'kerala-trails', 'solo-trekkers', 'women-trekkers', 'queer-trekkers', 'kid-friendly-treks', 'senior-trekkers', 'monsoon-treks', 'winter-treks', 'summit-stories', 'everest-base-camp', 'annapurna-circuit', 'kilimanjaro', 'pct-at-cdt', 'camino-de-santiago', 'gear-talk', 'tent-vs-homestay', 'trek-leaders', 'mountaineering', 'rock-climbing', 'bouldering', 'ice-climbing', 'via-ferrata'].map(s => ({
    category_slug: 'outdoors', subcategory_slug: 'outdoors-trekking', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['trekking', s],
  })),
  // Travel
  ...['solo-travelers', 'women-solo-travelers', 'queer-travelers', 'couples-travel', 'family-travel', 'road-trippers', 'bullet-riders-himalaya', 'royal-enfield-riders', 'super-bike-riders', 'cyclists-touring', 'backpackers-sea', 'eurotrip-planning', 'usa-roadtrip', 'nomads', 'slow-travel', 'luxury-travel', 'budget-travel', 'couchsurfing', 'hostel-life', 'airbnb-hosts', 'working-from-bali', 'working-from-lisbon', 'working-from-chiang-mai', 'digital-nomad-india', 'visa-strategies', 'schengen-tips', 'expat-life'].map(s => ({
    category_slug: 'outdoors', subcategory_slug: 'outdoors-travel', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 50, tags: ['travel', s],
  })),
  // Outdoor activities
  ...['scuba-diving', 'free-diving', 'surfing', 'paragliding', 'skydiving', 'kayaking-rafting', 'wild-camping', 'birdwatchers', 'wildlife-photography', 'wildlife-india', 'wildlife-africa', 'tiger-safari', 'running-marathons', 'ultra-runners', 'triathletes', 'ironman-prep', 'sailing', 'fishing', 'foraging'].map(s => ({
    category_slug: 'outdoors', subcategory_slug: 'outdoors-activities', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['outdoors', s],
  })),
];


// ============================================================================
// PART J — EVENTS & CULTURAL PROGRAMS (global + per-country)
// ============================================================================

const GLOBAL_FESTIVALS_2026 = [
  'pride-month-2026', 'lunar-new-year-2026', 'diwali-2026', 'holi-2026', 'eid-al-fitr-2026', 'eid-al-adha-2026',
  'christmas-2026', 'thanksgiving-2026', 'halloween-2026', 'easter-2026', 'passover-2026',
  'oktoberfest-2026', 'mardi-gras-2026', 'carnival-rio-2026', 'la-tomatina-2026', 'songkran-2026',
  'cherry-blossom-2026', 'midsummer-2026', 'day-of-the-dead-2026', 'hogmanay-2026',
];

const INDIA_FESTIVALS_2026 = [
  'pongal-2026', 'onam-2026', 'durga-puja-2026', 'ganesh-chaturthi-2026', 'navratri-2026',
  'karthigai-deepam-2026', 'vinayagar-chaturthi-2026', 'dussehra-2026', 'lohri-2026', 'baisakhi-2026',
  'bihu-2026', 'chhath-puja-2026', 'rath-yatra-2026', 'raksha-bandhan-2026', 'janmashtami-2026',
  'margazhi-music-season', 'chennai-sangamam', 'mahashivratri-2026',
];

const GLOBAL_MUSIC_FESTIVALS = [
  'coachella', 'tomorrowland', 'glastonbury', 'burning-man', 'lollapalooza', 'sxsw',
  'nh7-weekender', 'magnetic-fields-rajasthan', 'ziro-music-festival', 'hornbill-festival',
  'sunburn-india', 'vh1-supersonic', 'ee-naadu', 'fuji-rock', 'ultra-music-festival',
  'roskilde', 'primavera-sound', 'mawazine-morocco', 'rock-in-rio', 'splendour-in-grass',
];

const GLOBAL_FILM_FESTIVALS = [
  'cannes-film-festival', 'sundance', 'tiff', 'berlinale', 'venice-film-festival',
  'iffi-goa', 'mami-mumbai', 'kerala-film-festival', 'cinemalaya', 'busan-film',
];

const GLOBAL_SPORTS_EVENTS_2026 = [
  'fifa-world-cup-2026', 'olympics-la-2028-prep', 'cricket-t20-world-cup', 'ipl-2026',
  'wimbledon-2026', 'us-open-tennis', 'french-open', 'australian-open', 'super-bowl-2026',
  'champions-league-2026', 'asian-cup', 'commonwealth-games', 'asian-games',
];

export const EVENTS_ROOMS: SeedRoom[] = [
  // Global festivals
  ...GLOBAL_FESTIVALS_2026.map(f => ({
    category_slug: 'events', subcategory_slug: 'events-global-festivals', name: f,
    topic: `${f.replace(/-/g, ' ')} global community.`,
    flags: ['voice_enabled', 'time_bound', 'conference_capable'] as RoomFlag[],
    capacity: 200, tags: ['festival', 'global'],
  })),
  // India festivals
  ...INDIA_FESTIVALS_2026.map(f => ({
    category_slug: 'events', subcategory_slug: 'events-india-festivals', name: f,
    topic: `${f.replace(/-/g, ' ')} India community.`,
    flags: ['voice_enabled', 'time_bound'] as RoomFlag[],
    capacity: 100, tags: ['festival', 'india'],
  })),
  // Music festivals
  ...GLOBAL_MUSIC_FESTIVALS.map(f => ({
    category_slug: 'events', subcategory_slug: 'events-music-festivals', name: f,
    topic: `${f.replace(/-/g, ' ')} fans + attendees.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 100, tags: ['music-festival', f],
  })),
  // Film festivals
  ...GLOBAL_FILM_FESTIVALS.map(f => ({
    category_slug: 'events', subcategory_slug: 'events-film-festivals', name: f,
    topic: `${f.replace(/-/g, ' ')} watchers + attendees.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 100, tags: ['film-festival', f],
  })),
  // Sports
  ...GLOBAL_SPORTS_EVENTS_2026.map(f => ({
    category_slug: 'events', subcategory_slug: 'events-sports', name: f,
    topic: `${f.replace(/-/g, ' ')} watch parties.`,
    flags: ['voice_enabled', 'time_bound'] as RoomFlag[], capacity: 200, tags: ['sports', f],
  })),
  // Party coordination
  { category_slug: 'events', subcategory_slug: 'events-party', name: 'birthday-planning', topic: 'Planning birthday parties.', flags: ['voice_enabled'], capacity: 50, tags: ['party'] },
  { category_slug: 'events', subcategory_slug: 'events-party', name: 'wedding-planning', topic: 'Wedding planning, all stages.', flags: ['voice_enabled', 'conference_capable'], capacity: 50, tags: ['wedding'] },
  { category_slug: 'events', subcategory_slug: 'events-party', name: 'bachelor-party', topic: 'Bachelor party plans.', flags: ['voice_enabled', 'adult'], capacity: 50, tags: ['party'] },
  { category_slug: 'events', subcategory_slug: 'events-party', name: 'bachelorette-party', topic: 'Bachelorette plans.', flags: ['voice_enabled', 'adult'], capacity: 50, tags: ['party'] },
  { category_slug: 'events', subcategory_slug: 'events-party', name: 'housewarming', topic: 'Housewarming planning.', flags: [], capacity: 50, tags: ['party'] },
  { category_slug: 'events', subcategory_slug: 'events-party', name: 'dinner-parties', topic: 'Hosting dinner parties.', flags: [], capacity: 50, tags: ['dinner'] },
  { category_slug: 'events', subcategory_slug: 'events-party', name: 'kitty-parties', topic: 'Kitty party crew.', flags: ['voice_enabled'], capacity: 50, tags: ['kitty'] },
  // Concerts / live
  { category_slug: 'events', subcategory_slug: 'events-concerts', name: 'concert-tickets-trade', topic: 'Trade concert tickets globally.', flags: ['voice_enabled'], capacity: 100, tags: ['tickets'] },
  { category_slug: 'events', subcategory_slug: 'events-concerts', name: 'taylor-swift-fans', topic: 'Swifties globally.', flags: ['voice_enabled'], capacity: 200, tags: ['taylor'] },
  { category_slug: 'events', subcategory_slug: 'events-concerts', name: 'coldplay-fans', topic: 'Coldplay tour fans.', flags: ['voice_enabled'], capacity: 100, tags: ['coldplay'] },
  { category_slug: 'events', subcategory_slug: 'events-concerts', name: 'bts-army', topic: 'BTS ARMY worldwide.', flags: ['voice_enabled'], capacity: 200, tags: ['bts'] },
  { category_slug: 'events', subcategory_slug: 'events-concerts', name: 'ar-rahman-fans', topic: 'A.R. Rahman fans.', flags: ['voice_enabled'], capacity: 100, tags: ['arr'] },
  { category_slug: 'events', subcategory_slug: 'events-concerts', name: 'arijit-singh-fans', topic: 'Arijit Singh fans.', flags: [], capacity: 100, tags: ['arijit'] },
  { category_slug: 'events', subcategory_slug: 'events-concerts', name: 'classical-concerts', topic: 'Classical concert-goers.', flags: [], capacity: 50, tags: ['classical'] },
  { category_slug: 'events', subcategory_slug: 'events-concerts', name: 'jazz-clubs', topic: 'Jazz club regulars.', flags: [], capacity: 50, tags: ['jazz'] },
  { category_slug: 'events', subcategory_slug: 'events-concerts', name: 'indie-gigs', topic: 'Indie gig hoppers.', flags: [], capacity: 50, tags: ['indie'] },
  // Conferences
  { category_slug: 'events', subcategory_slug: 'events-conferences', name: 'tech-conferences', topic: 'Tech conference attendees.', flags: ['voice_enabled', 'conference_capable'], capacity: 100, tags: ['tech-conf'] },
  { category_slug: 'events', subcategory_slug: 'events-conferences', name: 'academic-conferences', topic: 'Academic conferences.', flags: ['voice_enabled', 'conference_capable'], capacity: 100, tags: ['academic'] },
  { category_slug: 'events', subcategory_slug: 'events-conferences', name: 'design-conferences', topic: 'Design conferences.', flags: ['voice_enabled'], capacity: 100, tags: ['design'] },
];

// ============================================================================
// PART K — GAMES & ESPORTS
// ============================================================================

export const GAMES_ROOMS: SeedRoom[] = [
  // Multiplayer / esports
  ...['valorant', 'cs2', 'apex-legends', 'fortnite', 'pubg-mobile', 'bgmi', 'cod-mobile', 'cod-warzone', 'clash-royale', 'clash-of-clans', 'lol', 'dota-2', 'overwatch-2', 'rainbow-six', 'rocket-league', 'fall-guys', 'splitgate', 'the-finals'].map(s => ({
    category_slug: 'games', subcategory_slug: 'games-multiplayer', name: s,
    topic: `${s.replace(/-/g, ' ')} players, global.`,
    flags: ['voice_enabled', 'cam_enabled', 'conference_capable'] as RoomFlag[], capacity: 100, tags: ['games', s],
  })),
  // MMO / coop
  ...['wow-classic', 'ffxiv', 'gw2', 'lost-ark', 'eso', 'destiny-2', 'warframe', 'path-of-exile', 'diablo-4', 'helldivers-2', 'sea-of-thieves', 'minecraft-builders', 'terraria', 'valheim', 'palworld'].map(s => ({
    category_slug: 'games', subcategory_slug: 'games-mmo-coop', name: s,
    topic: `${s.replace(/-/g, ' ')} players.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 100, tags: ['mmo', s],
  })),
  // Single-player / RPG
  ...['souls-likes', 'elden-ring', 'bg3', 'cyberpunk-2077', 'the-witcher', 'gta-online', 'gta-6-hype', 'red-dead', 'fallout', 'skyrim-modders', 'mass-effect', 'persona', 'final-fantasy', 'kingdom-hearts'].map(s => ({
    category_slug: 'games', subcategory_slug: 'games-rpg', name: s,
    topic: `${s.replace(/-/g, ' ')} fans.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 100, tags: ['rpg', s],
  })),
  // Platforms
  { category_slug: 'games', subcategory_slug: 'games-platforms', name: 'playstation-india', topic: 'PSN players India.', flags: ['voice_enabled'], capacity: 50, tags: ['playstation'] },
  { category_slug: 'games', subcategory_slug: 'games-platforms', name: 'playstation-global', topic: 'PSN global.', flags: ['voice_enabled'], capacity: 100, tags: ['playstation'] },
  { category_slug: 'games', subcategory_slug: 'games-platforms', name: 'xbox-global', topic: 'Xbox players.', flags: ['voice_enabled'], capacity: 100, tags: ['xbox'] },
  { category_slug: 'games', subcategory_slug: 'games-platforms', name: 'pc-master-race', topic: 'PC gamers.', flags: ['voice_enabled'], capacity: 100, tags: ['pc'] },
  { category_slug: 'games', subcategory_slug: 'games-platforms', name: 'steam-deck', topic: 'Steam Deck owners.', flags: [], capacity: 50, tags: ['steam-deck'] },
  { category_slug: 'games', subcategory_slug: 'games-platforms', name: 'nintendo-fans', topic: 'Nintendo fans.', flags: ['voice_enabled'], capacity: 100, tags: ['nintendo'] },
  { category_slug: 'games', subcategory_slug: 'games-platforms', name: 'mobile-gamers', topic: 'Mobile gamers.', flags: [], capacity: 50, tags: ['mobile'] },
  // Tabletop & card
  ...['chess-global', 'chess-india', 'lichess', 'poker-global', 'poker-online', 'rummy-online', 'ludo-king', 'carrom-online', 'dnd-5e', 'pathfinder', 'call-of-cthulhu', 'warhammer-40k', 'warhammer-fantasy', 'magic-the-gathering', 'yugioh', 'pokemon-tcg', 'lorcana', 'board-game-cafes', 'mahjong'].map(s => ({
    category_slug: 'games', subcategory_slug: 'games-tabletop-card', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 50, tags: ['tabletop', s],
  })),
  // Fighting / competitive
  ...['smash-bros', 'tekken', 'street-fighter', 'mortal-kombat', 'guilty-gear', 'speedrunners', 'esports-watchers', 'streamers', 'vtubers'].map(s => ({
    category_slug: 'games', subcategory_slug: 'games-fighting-compete', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'cam_enabled'] as RoomFlag[], capacity: 100, tags: ['fighting', s],
  })),
  // Cozy & casual
  ...['cozy-games', 'stardew-valley', 'animal-crossing', 'spiritfarer', 'unpacking', 'dredge', 'casual-gamers', 'puzzle-games', 'roguelikes'].map(s => ({
    category_slug: 'games', subcategory_slug: 'games-cozy-casual', name: s,
    topic: `${s.replace(/-/g, ' ')} fans.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['cozy', s],
  })),
  // NSFW
  { category_slug: 'games', subcategory_slug: 'games-adult', name: 'adult-games', topic: '🔞 Adult games discussion.', flags: ['adult'], capacity: 50, tags: ['adult'] },
];

// ============================================================================
// PART L — MUSIC
// ============================================================================

export const MUSIC_ROOMS: SeedRoom[] = [
  // By genre
  ...['indie-music', 'alt-rock', 'classic-rock', 'metal-general', 'death-metal', 'black-metal', 'doom-metal', 'prog-metal', 'power-metal', 'folk-metal', 'punk', 'hardcore', 'hip-hop-global', 'boom-bap', 'trap', 'drill', 'conscious-hip-hop', 'rnb', 'soul', 'funk', 'jazz-general', 'bebop', 'fusion', 'smooth-jazz', 'modal-jazz', 'blues', 'country-music', 'folk-american', 'folk-celtic', 'folk-nordic', 'electronic-general', 'house-music', 'techno', 'trance', 'dnb', 'dubstep', 'ambient', 'idm', 'lofi', 'breakcore', 'classical-western', 'baroque', 'romantic-era', 'modern-classical', 'classical-indian', 'hindustani', 'carnatic', 'dhrupad', 'film-scores', 'video-game-osts', 'theater-music', 'musicals'].map(s => ({
    category_slug: 'music', subcategory_slug: 'music-genre', name: s,
    topic: `${s.replace(/-/g, ' ')} fans.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 100, tags: ['music', s],
  })),
  // By language
  ...['tamil-music', 'hindi-music', 'telugu-music', 'malayalam-music', 'kannada-music', 'bengali-music', 'punjabi-music', 'marathi-music', 'gujarati-music', 'bhojpuri-music', 'assamese-music', 'odia-music', 'urdu-music', 'kpop', 'jpop', 'jrock', 'anime-music', 'vocaloid', 'city-pop', 'reggaeton', 'bachata', 'salsa', 'samba', 'bossa-nova', 'arabic-classical', 'rai', 'mahraganat', 'afrobeats', 'amapiano', 'highlife'].map(s => ({
    category_slug: 'music', subcategory_slug: 'music-language', name: s,
    topic: `${s.replace(/-/g, ' ')}.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 100, tags: ['music-lang', s],
  })),
  // Producers / instruments
  ...['producers-bedroom', 'dj-set-sharing', 'vinyl-collectors', 'cassette-revival', 'pedalboard-talk', 'synth-heads', 'modular-synth', 'guitar-talk', 'bass-talk', 'drummers', 'pianists', 'singers-warmup', 'songwriters', 'lyricists', 'composer-corner', 'ableton-users', 'logic-users', 'flstudio-users', 'cubase-users', 'protools-users', 'reaper-users', 'bandlab-bedroom'].map(s => ({
    category_slug: 'music', subcategory_slug: 'music-makers', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'cam_enabled', 'conference_capable'] as RoomFlag[], capacity: 50, tags: ['music-maker', s],
  })),
  // Misc
  { category_slug: 'music', subcategory_slug: 'music-meta', name: 'concert-buddies', topic: 'Find a concert buddy.', flags: [], capacity: 50, tags: ['concert'] },
  { category_slug: 'music', subcategory_slug: 'music-meta', name: 'band-looking-for-members', topic: 'Bands looking for members.', flags: ['voice_enabled', 'conference_capable'], capacity: 50, tags: ['band'] },
  { category_slug: 'music', subcategory_slug: 'music-meta', name: 'gig-photographers', topic: 'Music photographers.', flags: [], capacity: 50, tags: ['photo'] },
];


// ============================================================================
// PART M — ARTS & CREATIVE
// ============================================================================

export const ARTS_ROOMS: SeedRoom[] = [
  // Photography
  ...['street-photography', 'portrait-photography', 'fashion-photography', 'landscape-photography', 'wildlife-photography', 'astro-photography', 'macro-photography', 'sports-photography', 'documentary-photography', 'wedding-photography', 'food-photography', 'product-photography', 'fine-art-photography', 'film-photography', 'polaroid-instant', 'lomography', 'mobile-photography', 'drone-photography', 'lightroom-vs-c1', 'darkroom-community', 'gear-talk-photo'].map(s => ({
    category_slug: 'arts', subcategory_slug: 'arts-photography', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'cam_enabled'] as RoomFlag[], capacity: 50, tags: ['photo', s],
  })),
  // Visual art
  ...['oil-painters', 'watercolor', 'acrylic-painters', 'gouache', 'ink-art', 'charcoal-pastel', 'digital-painting', 'mixed-media', 'collage', 'screenprinting', 'lithography', 'woodblock-printing', 'procreate-artists', 'clip-studio', 'photoshop-artists', 'krita-users', 'blender-artists', 'zbrush-users', 'illustrator-pros'].map(s => ({
    category_slug: 'arts', subcategory_slug: 'arts-visual', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['art', s],
  })),
  // Animation / film
  ...['2d-animation', '3d-animation', 'motion-graphics', 'stop-motion', 'after-effects', 'short-film-makers', 'documentary-makers', 'indie-film', 'tamil-cinema', 'malayalam-new-wave', 'korean-cinema', 'japanese-cinema', 'french-cinema', 'world-cinema', 'criterion-collection', 'mubi-watchers', 'anime-makers'].map(s => ({
    category_slug: 'arts', subcategory_slug: 'arts-animation-film', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 50, tags: ['film', s],
  })),
  // Indian classical arts
  ...['bharatanatyam', 'kathak', 'odissi', 'kuchipudi', 'mohiniyattam', 'manipuri', 'kathakali', 'sattriya'].map(s => ({
    category_slug: 'arts', subcategory_slug: 'arts-indian-classical', name: s,
    topic: `${s.replace(/-/g, ' ')} dancers and lovers.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['classical-dance', s],
  })),
  // Dance
  ...['contemporary-dance', 'ballet', 'jazz-dance', 'hip-hop-dance', 'breakdance', 'salsa-dance', 'bachata-dance', 'kizomba', 'swing-dance', 'lindy-hop', 'tango-argentine', 'kpop-dance-covers', 'bollywood-dance', 'garba-raas', 'bhangra-dance'].map(s => ({
    category_slug: 'arts', subcategory_slug: 'arts-dance', name: s,
    topic: `${s.replace(/-/g, ' ')} dancers.`,
    flags: ['voice_enabled', 'cam_enabled'] as RoomFlag[], capacity: 50, tags: ['dance', s],
  })),
  // Theater
  ...['improv-theater', 'devised-theater', 'classical-theater', 'musical-theater', 'street-theater', 'mime-clowning'].map(s => ({
    category_slug: 'arts', subcategory_slug: 'arts-theater', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 50, tags: ['theater', s],
  })),
  // Writing
  ...['literary-fiction', 'sci-fi-writers', 'fantasy-writers', 'romance-writers', 'mystery-thriller-writers', 'horror-writers', 'weird-fiction', 'memoir-writers', 'journalism-pros', 'essayists', 'screenwriters', 'playwrights', 'poetry-page', 'poetry-slam', 'spoken-word', 'haiku-writers', 'ghazals', 'sonnets', 'free-verse', 'translators', 'nanowrimo', 'writers-room', 'editors-and-writers', 'freelance-writers', 'self-publishing', 'kindle-direct', 'book-publishers'].map(s => ({
    category_slug: 'arts', subcategory_slug: 'arts-writing', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 50, tags: ['writing', s],
  })),
  // Craft
  ...['pottery-ceramics', 'weaving', 'embroidery-kantha', 'embroidery-kasuti', 'embroidery-phulkari', 'chikankari', 'zardozi', 'block-printing', 'batik', 'kalamkari', 'madhubani', 'warli', 'gond', 'pattachitra', 'miniature-painting', 'knitting', 'crochet', 'macrame', 'quilting', 'sewing', 'tailoring', 'woodworking', 'metalwork', 'leatherwork', 'glassblowing', 'bookbinding', 'calligraphy-latin', 'calligraphy-arabic', 'calligraphy-devanagari', 'calligraphy-tamil', 'calligraphy-chinese', 'calligraphy-japanese', 'tattoo-artists', 'tattoo-collectors', 'jewelry-making', 'silversmithing'].map(s => ({
    category_slug: 'arts', subcategory_slug: 'arts-craft', name: s,
    topic: `${s.replace(/-/g, ' ')} makers.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['craft', s],
  })),
];

// ============================================================================
// PART N — FOOD & COOKING
// ============================================================================

export const FOOD_ROOMS: SeedRoom[] = [
  // Indian cuisines
  ...['tamil-cuisine', 'chettinad', 'andhra-cuisine', 'hyderabadi', 'kerala-cuisine', 'mangalorean', 'goan-cuisine', 'maharashtrian', 'gujarati-cuisine', 'rajasthani', 'punjabi-cuisine', 'bengali-cuisine', 'bihari-cuisine', 'awadhi', 'mughlai', 'kashmiri-cuisine', 'naga-cuisine', 'khasi', 'assamese-cuisine', 'manipuri-cuisine', 'sindhi-cuisine', 'parsi-cuisine', 'anglo-indian'].map(s => ({
    category_slug: 'food', subcategory_slug: 'food-indian-cuisine', name: s,
    topic: `${s.replace(/-/g, ' ')} cooks and eaters.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['food', 'india', s],
  })),
  // Global cuisines
  ...['italian-cuisine', 'french-cuisine', 'spanish-cuisine', 'greek-cuisine', 'turkish-cuisine', 'lebanese-cuisine', 'persian-cuisine', 'moroccan-cuisine', 'ethiopian-cuisine', 'nigerian-cuisine', 'mexican-cuisine', 'peruvian-cuisine', 'brazilian-cuisine', 'japanese-cuisine', 'korean-cuisine', 'thai-cuisine', 'vietnamese-cuisine', 'malaysian-cuisine', 'indonesian-cuisine', 'filipino-cuisine', 'chinese-sichuan', 'chinese-cantonese', 'tibetan-cuisine', 'bhutanese', 'nepali-cuisine'].map(s => ({
    category_slug: 'food', subcategory_slug: 'food-global-cuisine', name: s,
    topic: `${s.replace(/-/g, ' ')} cooks.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['food', 'global', s],
  })),
  // Baking / drinks / specialty
  ...['home-bakers', 'sourdough', 'bread-bakers', 'cake-decorators', 'chocolatiers', 'coffee-roasters', 'tea-snobs', 'chai-purists', 'filter-coffee-debate', 'wine-lovers', 'sommeliers-amateur', 'craft-beer', 'whisky-lovers', 'cocktail-bartenders', 'mocktail-mixers', 'kombucha-fermenters'].map(s => ({
    category_slug: 'food', subcategory_slug: 'food-specialty', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['food-spec', s],
  })),
  // Diet / lifestyle
  ...['vegan-global', 'jain-vegan', 'keto-eating', 'pcos-eating', 'diabetic-eating', 'gluten-free', 'dairy-free', 'intermittent-fasting', 'paleo', 'whole30', 'ayurvedic-eating', 'macrobiotic'].map(s => ({
    category_slug: 'food', subcategory_slug: 'food-diet-lifestyle', name: s,
    topic: `${s.replace(/-/g, ' ')} eaters.`,
    flags: [] as RoomFlag[], capacity: 50, tags: ['diet', s],
  })),
  // Situational
  ...['meal-prep', 'bachelor-cooking', 'hostel-cooking', 'dorm-recipes', '5-ingredient-recipes', '30-minute-meals', 'slow-sundays', 'budget-cooking', 'one-pot-meals', 'lunchbox-ideas'].map(s => ({
    category_slug: 'food', subcategory_slug: 'food-situational', name: s,
    topic: `${s.replace(/-/g, ' ')}.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['food-sit', s],
  })),
  // Eating out
  { category_slug: 'food', subcategory_slug: 'food-eating-out', name: 'street-food-india', topic: 'Street food across India.', flags: ['voice_enabled'], capacity: 50, tags: ['street-food'] },
  { category_slug: 'food', subcategory_slug: 'food-eating-out', name: 'street-food-sea', topic: 'SE Asia street food.', flags: ['voice_enabled'], capacity: 50, tags: ['street-food'] },
  { category_slug: 'food', subcategory_slug: 'food-eating-out', name: 'fine-dining', topic: 'Fine dining experiences.', flags: ['voice_enabled'], capacity: 50, tags: ['fine-dining'] },
  { category_slug: 'food', subcategory_slug: 'food-eating-out', name: 'michelin-global', topic: 'Michelin star adventures.', flags: ['voice_enabled'], capacity: 50, tags: ['michelin'] },
  { category_slug: 'food', subcategory_slug: 'food-eating-out', name: 'pop-up-dinners', topic: 'Pop-up dinners, supper clubs.', flags: ['voice_enabled'], capacity: 50, tags: ['popup'] },
  { category_slug: 'food', subcategory_slug: 'food-eating-out', name: 'foodie-events', topic: 'Foodie events worldwide.', flags: ['voice_enabled'], capacity: 50, tags: ['foodie'] },
  { category_slug: 'food', subcategory_slug: 'food-eating-out', name: 'food-bloggers', topic: 'Food bloggers, videographers.', flags: ['voice_enabled', 'conference_capable'], capacity: 50, tags: ['food-blogger'] },
];

// ============================================================================
// PART O — HEALTH, FITNESS & WELLNESS
// ============================================================================

export const WELLNESS_ROOMS: SeedRoom[] = [
  // Fitness
  ...['gym-rats', 'bodybuilding', 'powerlifting', 'crossfit', 'calisthenics', 'home-workouts', 'kettlebells', 'olympic-lifting', 'strongman'].map(s => ({
    category_slug: 'wellness', subcategory_slug: 'wellness-strength', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'cam_enabled'] as RoomFlag[], capacity: 50, tags: ['fitness', s],
  })),
  // Running / cycling
  ...['running-general', 'marathon-prep', 'couch-to-5k', 'trail-running', 'ultra-runners', 'cycling-general', 'bikepacking', 'cycle-commuters'].map(s => ({
    category_slug: 'wellness', subcategory_slug: 'wellness-endurance', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['endurance', s],
  })),
  // Yoga
  ...['yoga-general', 'ashtanga', 'iyengar', 'vinyasa', 'kundalini', 'yin-yoga', 'aerial-yoga', 'acroyoga', 'pilates', 'barre-fitness'].map(s => ({
    category_slug: 'wellness', subcategory_slug: 'wellness-yoga', name: s,
    topic: `${s.replace(/-/g, ' ')} practitioners.`,
    flags: ['voice_enabled', 'cam_enabled'] as RoomFlag[], capacity: 50, tags: ['yoga', s],
  })),
  // Martial arts
  ...['kalaripayattu', 'silambam', 'karate', 'taekwondo', 'judo', 'bjj', 'mma', 'boxing', 'muay-thai', 'kung-fu', 'aikido', 'kendo', 'iaido', 'fencing', 'archery'].map(s => ({
    category_slug: 'wellness', subcategory_slug: 'wellness-martial-arts', name: s,
    topic: `${s.replace(/-/g, ' ')} practitioners.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['martial-arts', s],
  })),
  // Swimming / water
  { category_slug: 'wellness', subcategory_slug: 'wellness-water', name: 'swimming', topic: 'Swimmers community.', flags: ['voice_enabled'], capacity: 50, tags: ['swimming'] },
  { category_slug: 'wellness', subcategory_slug: 'wellness-water', name: 'open-water-swimmers', topic: 'Open water swimming.', flags: ['voice_enabled'], capacity: 50, tags: ['swimming'] },
  // Meditation
  ...['meditation-general', 'vipassana', 'mindfulness', 'breathwork', 'wim-hof', 'zazen', 'transcendental-meditation'].map(s => ({
    category_slug: 'wellness', subcategory_slug: 'wellness-meditation', name: s,
    topic: `${s.replace(/-/g, ' ')} practitioners.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['meditation', s],
  })),
  // Body recomp journeys
  ...['weight-loss-journey', 'weight-gain-journey', 'body-recomposition', 'transformation-stories'].map(s => ({
    category_slug: 'wellness', subcategory_slug: 'wellness-journey', name: s,
    topic: `${s.replace(/-/g, ' ')}.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['journey', s],
  })),
  // Chronic / specific conditions
  ...['chronic-illness-global', 'cancer-survivors', 'cancer-caregivers', 'dementia-caregivers', 'heart-disease-support', 'autoimmune-warriors', 'long-covid', 'me-cfs', 'fibromyalgia', 'endometriosis', 'pcos-pcod-support', 'chronic-pain-community'].map(s => ({
    category_slug: 'wellness', subcategory_slug: 'wellness-chronic', name: s,
    topic: `${s.replace(/-/g, ' ')} peer support.`,
    flags: ['voice_enabled', 'crisis_card_pinned'] as RoomFlag[], capacity: 50, tags: ['chronic', s],
  })),
  // Mental health
  ...['mental-health-global', 'therapy-talk', 'anxiety-support', 'depression-support', 'bipolar-support', 'adhd-adult', 'autism-adult', 'ocd-support', 'ptsd-cptsd', 'eating-disorder-recovery', 'self-harm-recovery', 'psychosis-peer', 'borderline-bpd', 'dissociative-experiences'].map(s => ({
    category_slug: 'wellness', subcategory_slug: 'wellness-mental-health', name: s,
    topic: `${s.replace(/-/g, ' ')} peer support.`,
    flags: ['voice_enabled', 'crisis_card_pinned'] as RoomFlag[], capacity: 50, tags: ['mental-health', s],
  })),
  // Recovery
  ...['sober-curious', 'aa-friendly', 'na-friendly', 'addiction-recovery', 'gambling-recovery', 'porn-addiction-recovery', 'tech-addiction-recovery', 'sleep-troubles', 'insomnia-club'].map(s => ({
    category_slug: 'wellness', subcategory_slug: 'wellness-recovery', name: s,
    topic: `${s.replace(/-/g, ' ')} peer support.`,
    flags: ['voice_enabled', 'crisis_card_pinned'] as RoomFlag[], capacity: 50, tags: ['recovery', s],
  })),
  // Women's / men's / trans health
  ...['womens-health', 'menstrual-health', 'endo-warriors', 'menopause-perimenopause', 'fertility-journey', 'ivf-journey', 'pregnancy-trimester-1', 'pregnancy-trimester-2', 'pregnancy-trimester-3', 'postpartum-recovery', 'breastfeeding-support', 'miscarriage-stillbirth-support'].map(s => ({
    category_slug: 'wellness', subcategory_slug: 'wellness-womens-health', name: s,
    topic: `${s.replace(/-/g, ' ')} peer support.`,
    flags: ['voice_enabled', 'crisis_card_pinned'] as RoomFlag[], capacity: 50, tags: ['womens-health', s],
  })),
  ...['mens-health', 'prostate-health', 'erectile-dysfunction', 'testosterone-talk', 'andropause'].map(s => ({
    category_slug: 'wellness', subcategory_slug: 'wellness-mens-health', name: s,
    topic: `${s.replace(/-/g, ' ')} peer space.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['mens-health', s],
  })),
  ...['trans-health', 'hrt-talk', 'top-surgery', 'bottom-surgery', 'voice-training-trans', 'transition-timelines'].map(s => ({
    category_slug: 'wellness', subcategory_slug: 'wellness-trans-health', name: s,
    topic: `${s.replace(/-/g, ' ')} peer support.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['trans-health', s],
  })),
];


// ============================================================================
// PART P — TECH & BUILDERS
// ============================================================================

export const TECH_ROOMS: SeedRoom[] = [
  // Frontend
  ...['react', 'nextjs', 'vue', 'svelte', 'solidjs', 'astro', 'qwik', 'tailwind-css', 'css-tricks', 'web-animations', 'design-systems-eng', 'accessibility-a11y', 'web-performance', 'web-components', 'three-js', 'webgl-shaders'].map(s => ({
    category_slug: 'tech', subcategory_slug: 'tech-frontend', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'cam_enabled', 'conference_capable'] as RoomFlag[], capacity: 100, tags: ['frontend', s],
  })),
  // Backend
  ...['nodejs', 'python-backend', 'django', 'fastapi', 'flask', 'go-lang', 'rust-backend', 'java-spring', 'kotlin-backend', 'dotnet-core', 'php-laravel', 'ruby-rails', 'elixir-phoenix', 'graphql', 'grpc', 'rest-api-design', 'microservices', 'monolith-vs-microservices', 'event-driven'].map(s => ({
    category_slug: 'tech', subcategory_slug: 'tech-backend', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 100, tags: ['backend', s],
  })),
  // Devops / infra
  ...['kubernetes', 'docker', 'terraform', 'pulumi', 'aws-builders', 'gcp-builders', 'azure-builders', 'cloudflare-builders', 'vercel-builders', 'netlify-builders', 'supabase-builders', 'firebase-builders', 'postgres-deep', 'mysql-deep', 'redis-deep', 'kafka', 'rabbitmq', 'elasticsearch', 'observability-otel', 'datadog-grafana', 'on-call-life', 'sre-practices', 'ci-cd-pipelines', 'github-actions', 'gitlab-ci'].map(s => ({
    category_slug: 'tech', subcategory_slug: 'tech-devops', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 100, tags: ['devops', s],
  })),
  // AI / ML
  ...['llm-builders', 'rag-builders', 'agentic-systems', 'prompt-engineering', 'open-source-llms', 'claude-api-builders', 'openai-api-builders', 'gemini-api-builders', 'fine-tuning-llms', 'embeddings-vector-db', 'pgvector', 'pinecone-weaviate', 'mlops', 'pytorch-deep', 'tensorflow-deep', 'jax-flax', 'huggingface-community', 'diffusion-models', 'comfyui-builders', 'computer-vision', 'speech-stt-tts', 'whisper-streaming', 'ai-safety', 'ai-policy', 'ai-art-ethics'].map(s => ({
    category_slug: 'tech', subcategory_slug: 'tech-ai-ml', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 100, tags: ['ai-ml', s],
  })),
  // Security
  ...['infosec-general', 'web-app-security', 'pentesters', 'bug-bounty-hunters', 'red-team', 'blue-team', 'malware-analysis', 'reverse-engineering', 'crypto-cryptography', 'osint', 'ctf-players', 'capture-the-flag-coordination'].map(s => ({
    category_slug: 'tech', subcategory_slug: 'tech-security', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 50, tags: ['security', s],
  })),
  // Web3 / crypto dev
  ...['solidity-dev', 'evm-builders', 'solana-builders', 'rust-blockchain', 'zk-builders', 'l2-rollups', 'defi-protocols', 'nft-builders'].map(s => ({
    category_slug: 'tech', subcategory_slug: 'tech-web3', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['web3', s],
  })),
  // Game dev
  ...['unity-devs', 'unreal-devs', 'godot-devs', 'gamemaker-studio', 'pixel-art-game', 'low-poly-3d', 'shader-art', 'gameplay-design', 'narrative-design'].map(s => ({
    category_slug: 'tech', subcategory_slug: 'tech-game-dev', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 50, tags: ['game-dev', s],
  })),
  // Hardware / embedded
  ...['arduino-makers', 'raspberry-pi', 'esp32-builders', 'fpga-builders', 'pcb-design', 'soldering-iron-club', 'rotary-tool-club', '3d-printing-makers', 'cnc-makers', 'home-lab', 'self-hosters', 'home-assistant', 'matter-thread', 'mesh-networking', 'ham-radio'].map(s => ({
    category_slug: 'tech', subcategory_slug: 'tech-embedded', name: s,
    topic: `${s.replace(/-/g, ' ')} makers.`,
    flags: ['voice_enabled', 'cam_enabled'] as RoomFlag[], capacity: 50, tags: ['embedded', s],
  })),
  // Internet culture
  { category_slug: 'tech', subcategory_slug: 'tech-internet-culture', name: 'hacker-news-debaters', topic: 'HN top stories debate.', flags: ['voice_enabled'], capacity: 50, tags: ['hn'] },
  { category_slug: 'tech', subcategory_slug: 'tech-internet-culture', name: 'twitter-x-discourse', topic: 'Twitter/X discourse archive.', flags: [], capacity: 50, tags: ['twitter'] },
  { category_slug: 'tech', subcategory_slug: 'tech-internet-culture', name: 'old-internet-vibes', topic: 'Old internet nostalgia.', flags: ['voice_enabled'], capacity: 50, tags: ['nostalgia'] },
  { category_slug: 'tech', subcategory_slug: 'tech-internet-culture', name: 'tech-twitter-vs-reality', topic: 'Tech Twitter take-downs.', flags: [], capacity: 50, tags: ['twitter'] },
  { category_slug: 'tech', subcategory_slug: 'tech-internet-culture', name: 'reddit-deep', topic: 'Reddit lurkers and posters.', flags: [], capacity: 50, tags: ['reddit'] },
  { category_slug: 'tech', subcategory_slug: 'tech-internet-culture', name: 'tildes-mastodon-bluesky', topic: 'Alt-social-network folks.', flags: [], capacity: 50, tags: ['alt-social'] },

  // Specifically for Abe's interests (MQL5 etc. already in finance/trading; here we add builder-focused ones)
  { category_slug: 'tech', subcategory_slug: 'tech-trading-tools', name: 'mt4-mt5-developers', topic: 'MQL4/MQL5 EA + indicator devs.', flags: ['voice_enabled', 'cam_enabled', 'conference_capable'], capacity: 50, tags: ['mql', 'trading-dev'] },
  { category_slug: 'tech', subcategory_slug: 'tech-trading-tools', name: 'pine-script-devs', topic: 'TradingView Pine Script devs.', flags: ['voice_enabled', 'conference_capable'], capacity: 50, tags: ['pine', 'trading-dev'] },
  { category_slug: 'tech', subcategory_slug: 'tech-trading-tools', name: 'ctrader-cbots', topic: 'cTrader cBot devs.', flags: ['voice_enabled'], capacity: 50, tags: ['ctrader'] },
  { category_slug: 'tech', subcategory_slug: 'tech-trading-tools', name: 'ninjatrader-devs', topic: 'NinjaTrader scripters.', flags: ['voice_enabled'], capacity: 50, tags: ['ninjatrader'] },
  { category_slug: 'tech', subcategory_slug: 'tech-trading-tools', name: 'python-quant-libs', topic: 'Python quant libs, backtrader, vectorbt, etc.', flags: ['voice_enabled', 'conference_capable'], capacity: 50, tags: ['python-quant'] },
];

// ============================================================================
// PART Q — PETS & ANIMALS
// ============================================================================

export const PETS_ROOMS: SeedRoom[] = [
  // Dogs
  ...['dogs-general', 'puppy-parents', 'rescue-dogs', 'senior-dogs', 'reactive-dogs', 'service-dogs', 'therapy-dogs', 'training-positive-reinforcement', 'dog-grooming', 'dog-feeding-debate', 'raw-feeding-dogs', 'street-dogs-indies', 'labradors', 'golden-retrievers', 'german-shepherds', 'beagles', 'pugs-bulldogs', 'huskies-malamutes', 'doodles-poodles', 'shihtzus-lhasas', 'pomeranians', 'rottweilers-bullies', 'dachshunds', 'border-collies', 'shibas-akitas'].map(s => ({
    category_slug: 'pets', subcategory_slug: 'pets-dogs', name: s,
    topic: `${s.replace(/-/g, ' ')} owners.`,
    flags: ['voice_enabled', 'cam_enabled'] as RoomFlag[], capacity: 50, tags: ['dogs', s],
  })),
  // Cats
  ...['cats-general', 'kitten-parents', 'senior-cats', 'rescue-cats', 'persians', 'maine-coons', 'ragdolls', 'siamese', 'bengals', 'sphynx', 'street-cats-indies', 'multi-cat-households'].map(s => ({
    category_slug: 'pets', subcategory_slug: 'pets-cats', name: s,
    topic: `${s.replace(/-/g, ' ')} owners.`,
    flags: ['voice_enabled', 'cam_enabled'] as RoomFlag[], capacity: 50, tags: ['cats', s],
  })),
  // Birds / fish / reptiles / others
  ...['parrots', 'budgies', 'cockatiels', 'finches', 'pigeons-as-pets', 'chicken-keeping', 'duck-keeping'].map(s => ({
    category_slug: 'pets', subcategory_slug: 'pets-birds', name: s,
    topic: `${s.replace(/-/g, ' ')} keepers.`,
    flags: [] as RoomFlag[], capacity: 50, tags: ['birds', s],
  })),
  ...['aquariums-freshwater', 'aquariums-saltwater', 'reef-keeping', 'planted-tanks', 'koi-pond-keepers', 'shrimp-keepers'].map(s => ({
    category_slug: 'pets', subcategory_slug: 'pets-fish', name: s,
    topic: `${s.replace(/-/g, ' ')} hobbyists.`,
    flags: [] as RoomFlag[], capacity: 50, tags: ['fish', s],
  })),
  ...['snakes', 'lizards', 'geckos', 'tortoises-turtles', 'frogs-amphibians', 'tarantulas-arachnids'].map(s => ({
    category_slug: 'pets', subcategory_slug: 'pets-reptiles-exotic', name: s,
    topic: `${s.replace(/-/g, ' ')} keepers.`,
    flags: [] as RoomFlag[], capacity: 50, tags: ['reptiles', s],
  })),
  ...['rabbits', 'guinea-pigs', 'hamsters', 'mice-rats', 'ferrets', 'hedgehogs'].map(s => ({
    category_slug: 'pets', subcategory_slug: 'pets-small-mammals', name: s,
    topic: `${s.replace(/-/g, ' ')} owners.`,
    flags: [] as RoomFlag[], capacity: 50, tags: ['small-mammals', s],
  })),
  ...['horses-equestrians', 'cows-buffaloes', 'goats-sheep', 'pigs-as-pets'].map(s => ({
    category_slug: 'pets', subcategory_slug: 'pets-farm-animals', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['farm-animals', s],
  })),
  // Rescue & loss
  { category_slug: 'pets', subcategory_slug: 'pets-rescue', name: 'animal-rescue-volunteers', topic: 'Rescue volunteers, globally.', flags: ['voice_enabled', 'conference_capable'], capacity: 100, tags: ['rescue'] },
  { category_slug: 'pets', subcategory_slug: 'pets-rescue', name: 'fostering-pets', topic: 'Fostering animals.', flags: ['voice_enabled'], capacity: 50, tags: ['fostering'] },
  { category_slug: 'pets', subcategory_slug: 'pets-rescue', name: 'animal-shelters-india', topic: 'India animal shelters.', flags: ['voice_enabled'], capacity: 50, tags: ['shelter', 'india'] },
  { category_slug: 'pets', subcategory_slug: 'pets-loss', name: 'pet-loss-support', topic: 'Losing a pet. Held with care.', flags: ['voice_enabled', 'crisis_card_pinned'], capacity: 50, tags: ['loss'] },
  { category_slug: 'pets', subcategory_slug: 'pets-loss', name: 'rainbow-bridge', topic: 'Remembering pets we lost.', flags: [], capacity: 50, tags: ['memorial'] },
];


// ============================================================================
// PART R — BOOKS, LEARNING & IDEAS
// ============================================================================

export const BOOKS_ROOMS: SeedRoom[] = [
  // Genres
  ...['literary-fiction', 'sci-fi-readers', 'fantasy-readers', 'romance-readers', 'mystery-thriller', 'horror-readers', 'historical-fiction', 'weird-fiction', 'magical-realism', 'climate-fiction', 'lit-mag-readers'].map(s => ({
    category_slug: 'books', subcategory_slug: 'books-genre', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['books', s],
  })),
  // Non-fiction
  ...['biography-readers', 'memoir-readers', 'history-readers', 'science-readers', 'pop-science', 'psychology-readers', 'sociology-readers', 'business-books', 'self-help-skeptics', 'philosophy-readers', 'theology-readers', 'economics-readers', 'political-philosophy'].map(s => ({
    category_slug: 'books', subcategory_slug: 'books-nonfiction', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['non-fiction', s],
  })),
  // Poetry / philosophy
  ...['poetry-classical', 'poetry-modern', 'poetry-tamil', 'poetry-urdu-shayari', 'poetry-hindi', 'poetry-bengali', 'poetry-malayalam', 'haiku-readers', 'sonnets', 'translated-poetry'].map(s => ({
    category_slug: 'books', subcategory_slug: 'books-poetry', name: s,
    topic: `${s.replace(/-/g, ' ')}.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['poetry', s],
  })),
  ...['stoicism', 'existentialism', 'phenomenology', 'analytic-philosophy', 'continental-philosophy', 'eastern-philosophy', 'advaita', 'buddhist-philosophy', 'jain-philosophy', 'sufi-thought', 'ethics-meta-ethics', 'political-theory'].map(s => ({
    category_slug: 'books', subcategory_slug: 'books-philosophy', name: s,
    topic: `${s.replace(/-/g, ' ')} discussion.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 50, tags: ['philosophy', s],
  })),
  // Language learning
  ...['learning-tamil', 'learning-hindi', 'learning-sanskrit', 'learning-arabic', 'learning-mandarin', 'learning-japanese', 'learning-korean', 'learning-spanish', 'learning-french', 'learning-german', 'learning-italian', 'learning-portuguese', 'learning-russian', 'learning-turkish', 'duolingo-streakers', 'polyglot-corner'].map(s => ({
    category_slug: 'books', subcategory_slug: 'books-language-learning', name: s,
    topic: `${s.replace(/-/g, ' ')} practice.`,
    flags: ['voice_enabled', 'cam_enabled'] as RoomFlag[], capacity: 50, tags: ['language', s],
  })),
  // Science / math / geography
  ...['physics-enthusiasts', 'quantum-curious', 'astrophysics', 'astronomy-amateurs', 'biology-life', 'evolution-talk', 'genetics-genomics', 'neuroscience-popular', 'chemistry-curious', 'climate-science', 'paleontology', 'pure-math', 'applied-math', 'recreational-math', 'statistics-stats', 'cryptography-popular', 'geography-buffs', 'cartography', 'maps-and-territories'].map(s => ({
    category_slug: 'books', subcategory_slug: 'books-science-math', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled', 'conference_capable'] as RoomFlag[], capacity: 50, tags: ['science', s],
  })),
];

// ============================================================================
// PART S — FAITH & SPIRITUALITY
// ============================================================================

export const FAITH_ROOMS: SeedRoom[] = [
  // Hindu
  ...['hindu-general', 'shaivism', 'vaishnavism', 'shaktism', 'smartism', 'kashmir-shaivism', 'sri-vidya', 'bhakti-movement', 'gita-study', 'ramayana-readers', 'mahabharata-readers', 'puranas', 'upanishads', 'vedanta-advaita', 'iskcon', 'arya-samaj', 'tamil-shaiva-siddhanta', 'sant-mat'].map(s => ({
    category_slug: 'faith', subcategory_slug: 'faith-hindu', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['hindu', s],
  })),
  // Islam
  ...['islam-general', 'quran-study', 'hadith-study', 'sunni', 'shia', 'sufi-tariqa', 'salafi', 'modernist-muslim', 'progressive-muslim', 'queer-muslim', 'reverts-converts-islam', 'ramadan-circle'].map(s => ({
    category_slug: 'faith', subcategory_slug: 'faith-islam', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['islam', s],
  })),
  // Christianity
  ...['christianity-general', 'catholic', 'orthodox', 'protestant', 'pentecostal', 'evangelical', 'mainline', 'progressive-christian', 'queer-christian', 'mystics-christian', 'bible-study', 'lectio-divina', 'taize-community'].map(s => ({
    category_slug: 'faith', subcategory_slug: 'faith-christian', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['christian', s],
  })),
  // Other faiths
  ...['sikh-general', 'gurbani-study', 'amritdhari', 'sikh-diaspora'].map(s => ({
    category_slug: 'faith', subcategory_slug: 'faith-sikh', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['sikh', s],
  })),
  ...['jain-general', 'shvetambara', 'digambara', 'sthanakvasi'].map(s => ({
    category_slug: 'faith', subcategory_slug: 'faith-jain', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['jain', s],
  })),
  ...['buddhist-general', 'theravada', 'mahayana', 'vajrayana', 'tibetan-buddhism', 'zen-soto', 'rinzai-zen', 'pure-land', 'engaged-buddhism', 'ambedkarite-buddhism'].map(s => ({
    category_slug: 'faith', subcategory_slug: 'faith-buddhist', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['buddhist', s],
  })),
  ...['zoroastrian-parsi', 'bahai-faith', 'jewish-judaism', 'judaism-orthodox', 'judaism-reform', 'judaism-conservative', 'kabbalah', 'shinto', 'taoism', 'confucianism', 'indigenous-spirituality'].map(s => ({
    category_slug: 'faith', subcategory_slug: 'faith-other', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['faith', s],
  })),
  // Skeptic / agnostic / atheist / interfaith
  { category_slug: 'faith', subcategory_slug: 'faith-skeptic', name: 'agnostic-lounge', topic: 'Agnostics, all welcome.', flags: ['voice_enabled'], capacity: 50, tags: ['agnostic'] },
  { category_slug: 'faith', subcategory_slug: 'faith-skeptic', name: 'atheist-lounge', topic: 'Atheists, philosophy and life.', flags: ['voice_enabled'], capacity: 50, tags: ['atheist'] },
  { category_slug: 'faith', subcategory_slug: 'faith-skeptic', name: 'ex-religious-deconstruction', topic: 'Leaving faith, deconstruction.', flags: ['voice_enabled', 'crisis_card_pinned'], capacity: 50, tags: ['ex-religious'] },
  { category_slug: 'faith', subcategory_slug: 'faith-skeptic', name: 'spiritual-not-religious', topic: 'SBNR community.', flags: ['voice_enabled'], capacity: 50, tags: ['sbnr'] },
  { category_slug: 'faith', subcategory_slug: 'faith-interfaith', name: 'interfaith-dialogue', topic: 'Interfaith respectful dialogue.', flags: ['voice_enabled', 'conference_capable'], capacity: 100, tags: ['interfaith'] },
  { category_slug: 'faith', subcategory_slug: 'faith-interfaith', name: 'mystics-cross-tradition', topic: 'Mystics across traditions.', flags: ['voice_enabled'], capacity: 50, tags: ['mystic'] },
  { category_slug: 'faith', subcategory_slug: 'faith-interfaith', name: 'comparative-religion', topic: 'Academic comparative religion.', flags: ['voice_enabled', 'conference_capable'], capacity: 50, tags: ['academic'] },
  // Astrology
  ...['astrology-western', 'vedic-jyotish', 'nadi-astrology', 'chinese-astrology', 'tarot-readers', 'oracle-cards', 'numerology', 'palmistry', 'i-ching', 'feng-shui', 'vastu', 'natal-chart-reading', 'transits-discussion'].map(s => ({
    category_slug: 'faith', subcategory_slug: 'faith-astrology', name: s,
    topic: `${s.replace(/-/g, ' ')} community.`,
    flags: ['voice_enabled'] as RoomFlag[], capacity: 50, tags: ['astrology', s],
  })),
];

// ============================================================================
// PART T — JUST VIBES & RANDOM
// ============================================================================

export const VIBES_ROOMS: SeedRoom[] = [
  // Memes
  { category_slug: 'vibes', subcategory_slug: 'vibes-memes', name: 'memes-global', topic: 'Memes, daily fresh.', flags: ['voice_enabled'], capacity: 100, tags: ['memes'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-memes', name: 'memes-india', topic: 'India memes.', flags: ['voice_enabled'], capacity: 100, tags: ['memes', 'india'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-memes', name: 'memes-tamil', topic: 'Tamil memes.', flags: ['voice_enabled'], capacity: 100, tags: ['memes', 'tamil'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-memes', name: 'memes-malayalam', topic: 'Malayalam meme reservoir.', flags: ['voice_enabled'], capacity: 50, tags: ['memes', 'malayalam'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-memes', name: 'memes-telugu', topic: 'Telugu memes.', flags: ['voice_enabled'], capacity: 50, tags: ['memes', 'telugu'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-memes', name: 'memes-pakistani', topic: 'Pakistani memes.', flags: ['voice_enabled'], capacity: 50, tags: ['memes', 'pakistan'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-memes', name: 'memes-arab', topic: 'Arab memes.', flags: ['voice_enabled'], capacity: 50, tags: ['memes', 'arab'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-memes', name: 'memes-east-asia', topic: 'East Asian memes.', flags: ['voice_enabled'], capacity: 50, tags: ['memes', 'east-asia'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-memes', name: 'memes-latin-america', topic: 'Latin American memes.', flags: ['voice_enabled'], capacity: 50, tags: ['memes', 'latam'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-memes', name: 'shitposting', topic: 'No rules. Just shitposts.', flags: ['voice_enabled'], capacity: 100, tags: ['shitposting'] },
  // Confessions & vent
  { category_slug: 'vibes', subcategory_slug: 'vibes-confessions', name: 'anon-confessions', topic: 'Anonymous confessions.', flags: ['anonymous_only'], capacity: 100, tags: ['confessions'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-confessions', name: 'embarrassing-stories', topic: 'Embarrassing stories.', flags: ['anonymous_only'], capacity: 50, tags: ['stories'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-confessions', name: 'unpopular-opinions', topic: 'Unpopular opinions.', flags: [], capacity: 50, tags: ['opinions'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-confessions', name: 'hot-takes', topic: 'Hot takes only.', flags: [], capacity: 50, tags: ['takes'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-vent', name: 'vent-corner', topic: 'Just need to vent. Listeners welcome.', flags: ['voice_enabled', 'crisis_card_pinned'], capacity: 50, tags: ['vent'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-vent', name: '3am-thoughts', topic: '3am thoughts. We are all here.', flags: ['voice_enabled'], capacity: 100, tags: ['3am'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-vent', name: 'lonely-tonight', topic: 'Feeling lonely. Want to talk.', flags: ['voice_enabled', 'crisis_card_pinned'], capacity: 50, tags: ['lonely'] },
  // Nostalgia
  { category_slug: 'vibes', subcategory_slug: 'vibes-nostalgia', name: 'yahoo-messenger-veterans', topic: 'The ones who remember chat rooms 2002.', flags: ['voice_enabled'], capacity: 100, tags: ['nostalgia', 'yahoo'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-nostalgia', name: '90s-kids', topic: '90s kids. Anywhere in the world.', flags: ['voice_enabled'], capacity: 100, tags: ['nostalgia', '90s'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-nostalgia', name: '2000s-kids', topic: 'Y2K kids.', flags: ['voice_enabled'], capacity: 100, tags: ['nostalgia', '2000s'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-nostalgia', name: '80s-kids', topic: '80s kids.', flags: ['voice_enabled'], capacity: 100, tags: ['nostalgia', '80s'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-nostalgia', name: '70s-kids', topic: '70s kids.', flags: ['voice_enabled'], capacity: 50, tags: ['nostalgia', '70s'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-nostalgia', name: 'old-bollywood-fans', topic: 'Old Bollywood movies fans.', flags: ['voice_enabled'], capacity: 50, tags: ['nostalgia', 'bollywood'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-nostalgia', name: 'old-kollywood-fans', topic: 'Old Tamil cinema lovers.', flags: ['voice_enabled'], capacity: 50, tags: ['nostalgia', 'kollywood'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-nostalgia', name: 'old-hollywood-fans', topic: 'Old Hollywood classics.', flags: ['voice_enabled'], capacity: 50, tags: ['nostalgia', 'hollywood'] },
  // Anime / TV / movies
  { category_slug: 'vibes', subcategory_slug: 'vibes-anime', name: 'anime-general', topic: 'Anime watchers, global.', flags: ['voice_enabled'], capacity: 100, tags: ['anime'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-anime', name: 'shonen-jump', topic: 'Shonen Jump readers.', flags: ['voice_enabled'], capacity: 50, tags: ['anime', 'manga'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-anime', name: 'shoujo-josei', topic: 'Shoujo, Josei readers.', flags: ['voice_enabled'], capacity: 50, tags: ['anime'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-anime', name: 'seinen', topic: 'Seinen fans.', flags: ['voice_enabled'], capacity: 50, tags: ['anime'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-anime', name: 'studio-ghibli', topic: 'Ghibli films fans.', flags: ['voice_enabled'], capacity: 50, tags: ['ghibli'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-anime', name: 'kdrama-watchers', topic: 'K-drama watchers.', flags: ['voice_enabled'], capacity: 100, tags: ['kdrama'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-anime', name: 'cdrama-watchers', topic: 'C-drama watchers.', flags: ['voice_enabled'], capacity: 50, tags: ['cdrama'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-anime', name: 'turkish-dizi-watchers', topic: 'Turkish dizi fans.', flags: ['voice_enabled'], capacity: 50, tags: ['dizi'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-anime', name: 'telenovela-watchers', topic: 'Telenovela watchers.', flags: ['voice_enabled'], capacity: 50, tags: ['telenovela'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-tv', name: 'sitcom-rewatchers', topic: 'Friends, Office, Seinfeld rewatchers.', flags: ['voice_enabled'], capacity: 100, tags: ['sitcom'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-tv', name: 'prestige-tv', topic: 'Prestige TV watchers.', flags: ['voice_enabled', 'conference_capable'], capacity: 100, tags: ['prestige'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-tv', name: 'reality-tv', topic: 'Reality TV fans.', flags: ['voice_enabled'], capacity: 100, tags: ['reality'] },
  { category_slug: 'vibes', subcategory_slug: 'vibes-tv', name: 'bigg-boss', topic: 'Bigg Boss watchers.', flags: ['voice_enabled', 'time_bound'], capacity: 100, tags: ['bigg-boss'] },
];


// ============================================================================
// MASTER GENERATOR — buildFullCatalog()
// ============================================================================

export function buildFullCatalog(): {
  categories: SeedCategory[];
  subcategories: SeedSubcategory[];
  rooms: SeedRoom[];
} {
  const rooms: SeedRoom[] = [];

  // Part A — Regional (per country, per city)
  rooms.push(...generateRegionalRooms());

  // Part B — Romance & Dating (per country)
  rooms.push(...generateRomanceRooms());

  // Part C — LGBTQ+ & Queer (per country)
  rooms.push(...generateLGBTQRooms());

  // Part D — Adult & Sex-Positive (global)
  rooms.push(...ADULT_GLOBAL_ROOMS);

  // Part E — Identity & Community (global)
  rooms.push(...IDENTITY_ROOMS);

  // Part F — Students Global
  rooms.push(...STUDENT_ROOMS);

  // Part G — Career & Work
  rooms.push(...CAREER_ROOMS);

  // Part H — Money, Trading, Investing
  rooms.push(...FINANCE_ROOMS);

  // Part I — Travel, Trek, Outdoors
  rooms.push(...OUTDOORS_ROOMS);

  // Part J — Events & Cultural Programs
  rooms.push(...EVENTS_ROOMS);

  // Part K — Games & Esports
  rooms.push(...GAMES_ROOMS);

  // Part L — Music
  rooms.push(...MUSIC_ROOMS);

  // Part M — Arts & Creative
  rooms.push(...ARTS_ROOMS);

  // Part N — Food & Cooking
  rooms.push(...FOOD_ROOMS);

  // Part O — Health, Fitness & Wellness
  rooms.push(...WELLNESS_ROOMS);

  // Part P — Tech & Builders
  rooms.push(...TECH_ROOMS);

  // Part Q — Pets & Animals
  rooms.push(...PETS_ROOMS);

  // Part R — Books, Learning & Ideas
  rooms.push(...BOOKS_ROOMS);

  // Part S — Faith & Spirituality
  rooms.push(...FAITH_ROOMS);

  // Part T — Just Vibes & Random
  rooms.push(...VIBES_ROOMS);

  // Build subcategory list from rooms (deduped)
  const subcategoriesMap = new Map<string, SeedSubcategory>();
  let sortIdx = 0;
  for (const room of rooms) {
    const key = `${room.category_slug}::${room.subcategory_slug}`;
    if (!subcategoriesMap.has(key)) {
      subcategoriesMap.set(key, {
        category_slug: room.category_slug,
        slug: room.subcategory_slug,
        name: room.subcategory_slug.split('-').slice(1).join(' ') || room.subcategory_slug.replace(/-/g, ' '),
        description: '',
        sort_order: sortIdx++,
        region: room.region,
        language: room.language,
      });
    }
  }

  return {
    categories: CATEGORIES,
    subcategories: Array.from(subcategoriesMap.values()),
    rooms,
  };
}

// ============================================================================
// CLI ENTRYPOINT — for verifying counts before deploy
// ============================================================================

// To run from CLI for verification:  npx tsx seeds/rooms-catalog.ts --print
// (Guarded with `declare` so it type-checks without @types/node installed.)
declare const require: { main?: unknown } | undefined;
declare const module: unknown;
declare const process: { argv: string[] } | undefined;

const _isCLI = (typeof require !== 'undefined' && require?.main === module)
  || (typeof process !== 'undefined' && process?.argv?.includes('--print'));

if (_isCLI) {
  const { categories, subcategories, rooms } = buildFullCatalog();
  console.log('Karochat catalog generated:');
  console.log(`  Categories:    ${categories.length}`);
  console.log(`  Subcategories: ${subcategories.length}`);
  console.log(`  Rooms:         ${rooms.length}`);
  // Per-category breakdown
  const byCategory = rooms.reduce<Record<string, number>>((acc, r) => {
    acc[r.category_slug] = (acc[r.category_slug] || 0) + 1;
    return acc;
  }, {});
  console.log('\nPer-category counts:');
  for (const cat of categories) {
    console.log(`  ${cat.emoji} ${cat.name.padEnd(34)} ${byCategory[cat.slug] || 0}`);
  }
}
