import { useState } from "react";
import { cn } from "@/lib/utils";

// Country name → ISO 3166-1 alpha-2 (for flagcdn.com). Case-insensitive lookup.
const COUNTRY_ISO2: Record<string, string> = {
  russia: "ru", ukraine: "ua", kazakhstan: "kz", china: "cn", india: "in",
  usa: "us", "united states": "us", "united states of america": "us",
  indonesia: "id", philippines: "ph", malaysia: "my", kenya: "ke",
  tanzania: "tz", vietnam: "vn", kyrgyzstan: "kg", nigeria: "ng",
  poland: "pl", "great britain": "gb", uk: "gb", "united kingdom": "gb",
  madagascar: "mg", congo: "cd", "dr congo": "cd", cambodia: "kh",
  burundi: "bi", israel: "il", "hong kong": "hk", turkey: "tr",
  germany: "de", france: "fr", spain: "es", italy: "it", egypt: "eg",
  brazil: "br", mexico: "mx", colombia: "co", argentina: "ar",
  canada: "ca", australia: "au", netherlands: "nl", portugal: "pt",
  romania: "ro", belarus: "by", japan: "jp", "south korea": "kr",
  korea: "kr", thailand: "th", "saudi arabia": "sa", uae: "ae",
  "united arab emirates": "ae", pakistan: "pk", bangladesh: "bd",
  "sri lanka": "lk", nepal: "np", myanmar: "mm", laos: "la", taiwan: "tw",
  singapore: "sg", "south africa": "za", morocco: "ma", algeria: "dz",
  tunisia: "tn", ghana: "gh", ethiopia: "et", uganda: "ug",
  cameroon: "cm", angola: "ao", mozambique: "mz", zimbabwe: "zw",
  chile: "cl", peru: "pe", venezuela: "ve", ecuador: "ec", bolivia: "bo",
  uruguay: "uy", paraguay: "py", greece: "gr", sweden: "se",
  norway: "no", finland: "fi", denmark: "dk", ireland: "ie",
  austria: "at", belgium: "be", switzerland: "ch", "czech republic": "cz",
  czechia: "cz", hungary: "hu", bulgaria: "bg", serbia: "rs",
  croatia: "hr", slovakia: "sk", slovenia: "si", lithuania: "lt",
  latvia: "lv", estonia: "ee", moldova: "md", georgia: "ge",
  armenia: "am", azerbaijan: "az", uzbekistan: "uz", tajikistan: "tj",
  turkmenistan: "tm", afghanistan: "af", iran: "ir", iraq: "iq",
  syria: "sy", jordan: "jo", lebanon: "lb", kuwait: "kw", qatar: "qa",
  bahrain: "bh", oman: "om", yemen: "ye",
};

export function Flag({ name, className }: { name: string; className?: string }) {
  const iso = COUNTRY_ISO2[name.trim().toLowerCase()];
  const [err, setErr] = useState(false);
  if (!iso || err) {
    return (
      <span className={cn("inline-flex items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground", className)}>
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={`https://flagcdn.com/w80/${iso}.png`}
      srcSet={`https://flagcdn.com/w160/${iso}.png 2x`}
      alt={name}
      loading="lazy"
      onError={() => setErr(true)}
      className={cn("inline-block h-6 w-8 rounded object-cover", className)}
    />
  );
}

// Brand slug lookup for simple-icons CDN.
// Add common OTP services; unknowns fall back to Google favicon then letters.
const SERVICE_BRAND: Array<[RegExp, { slug: string; color?: string; domain?: string }]> = [
  [/whats\s*app/i, { slug: "whatsapp", color: "25D366", domain: "whatsapp.com" }],
  [/telegram/i, { slug: "telegram", color: "26A5E4", domain: "telegram.org" }],
  [/instagram/i, { slug: "instagram", color: "E4405F", domain: "instagram.com" }],
  [/facebook|meta/i, { slug: "facebook", color: "1877F2", domain: "facebook.com" }],
  [/google|gmail|youtube/i, { slug: "google", color: "4285F4", domain: "google.com" }],
  [/youtube/i, { slug: "youtube", color: "FF0000", domain: "youtube.com" }],
  [/discord/i, { slug: "discord", color: "5865F2", domain: "discord.com" }],
  [/twitter|(^|\s)x(\s|$)/i, { slug: "x", color: "000000", domain: "twitter.com" }],
  [/viber/i, { slug: "viber", color: "7360F2", domain: "viber.com" }],
  [/wechat|weixin/i, { slug: "wechat", color: "07C160", domain: "wechat.com" }],
  [/amazon/i, { slug: "amazon", color: "FF9900", domain: "amazon.com" }],
  [/microsoft|outlook|hotmail|xbox|skype/i, { slug: "microsoft", color: "5E5E5E", domain: "microsoft.com" }],
  [/uber/i, { slug: "uber", color: "000000", domain: "uber.com" }],
  [/apple|icloud/i, { slug: "apple", color: "000000", domain: "apple.com" }],
  [/netflix/i, { slug: "netflix", color: "E50914", domain: "netflix.com" }],
  [/yandex/i, { slug: "yandex", color: "FF0000", domain: "yandex.com" }],
  [/ok\.?ru|odnoklassniki/i, { slug: "odnoklassniki", color: "EE8208", domain: "ok.ru" }],
  [/(^|\s)vk(\s|$)|vkontakte/i, { slug: "vk", color: "0077FF", domain: "vk.com" }],
  [/linkedin/i, { slug: "linkedin", color: "0A66C2", domain: "linkedin.com" }],
  [/olx/i, { slug: "olx", color: "23E5DB", domain: "olx.com" }],
  [/tiktok|douyin/i, { slug: "tiktok", color: "000000", domain: "tiktok.com" }],
  [/snapchat/i, { slug: "snapchat", color: "FFFC00", domain: "snapchat.com" }],
  [/twitch/i, { slug: "twitch", color: "9146FF", domain: "twitch.tv" }],
  [/paypal/i, { slug: "paypal", color: "003087", domain: "paypal.com" }],
  [/binance/i, { slug: "binance", color: "F0B90B", domain: "binance.com" }],
  [/coinbase/i, { slug: "coinbase", color: "0052FF", domain: "coinbase.com" }],
  [/tinder/i, { slug: "tinder", color: "FF6B6B", domain: "tinder.com" }],
  [/bumble/i, { slug: "bumble", color: "FFB43C", domain: "bumble.com" }],
  [/badoo/i, { slug: "badoo", color: "7B45E0", domain: "badoo.com" }],
  [/spotify/i, { slug: "spotify", color: "1DB954", domain: "spotify.com" }],
  [/reddit/i, { slug: "reddit", color: "FF4500", domain: "reddit.com" }],
  [/pinterest/i, { slug: "pinterest", color: "BD081C", domain: "pinterest.com" }],
  [/airbnb/i, { slug: "airbnb", color: "FF5A5F", domain: "airbnb.com" }],
  [/booking/i, { slug: "bookingdotcom", color: "003580", domain: "booking.com" }],
  [/alibaba|aliexpress/i, { slug: "aliexpress", color: "FF4747", domain: "aliexpress.com" }],
  [/ebay/i, { slug: "ebay", color: "E53238", domain: "ebay.com" }],
  [/shopee/i, { slug: "shopee", color: "EE4D2D", domain: "shopee.com" }],
  [/lazada/i, { slug: "lazada", color: "0F146D", domain: "lazada.com" }],
  [/paytm/i, { slug: "paytm", color: "00BAF2", domain: "paytm.com" }],
  [/phonepe/i, { slug: "phonepe", color: "5F259F", domain: "phonepe.com" }],
  [/flipkart/i, { slug: "flipkart", color: "2874F0", domain: "flipkart.com" }],
  [/swiggy/i, { slug: "swiggy", color: "FC8019", domain: "swiggy.com" }],
  [/zomato/i, { slug: "zomato", color: "E23744", domain: "zomato.com" }],
  [/signal/i, { slug: "signal", color: "3A76F0", domain: "signal.org" }],
  [/line/i, { slug: "line", color: "00C300", domain: "line.me" }],
  [/kakao/i, { slug: "kakao", color: "FFCD00", domain: "kakao.com" }],
];

export function ServiceIcon({ name, className }: { name: string; className?: string }) {
  const [stage, setStage] = useState(0);
  const brand = SERVICE_BRAND.find(([re]) => re.test(name))?.[1];

  const initials = (name.replace(/[^a-z0-9]+/gi, " ").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || name.slice(0, 2)).toUpperCase();

  // Stage 0: simpleicons CDN. Stage 1: Google favicon. Stage 2: initials.
  if (brand && stage === 0) {
    return (
      <img
        src={`https://cdn.simpleicons.org/${brand.slug}/${brand.color ?? "888888"}`}
        alt={name}
        loading="lazy"
        onError={() => setStage(1)}
        className={cn("inline-block h-6 w-6 object-contain", className)}
      />
    );
  }
  if (brand && stage === 1) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?sz=64&domain=${brand.domain ?? brand.slug + ".com"}`}
        alt={name}
        loading="lazy"
        onError={() => setStage(2)}
        className={cn("inline-block h-6 w-6 rounded object-contain", className)}
      />
    );
  }
  return (
    <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary", className)}>
      {initials || "•"}
    </span>
  );
}