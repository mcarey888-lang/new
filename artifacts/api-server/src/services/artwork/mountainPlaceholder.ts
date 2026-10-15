/**
 * Shared, illustrative stand-in for catalogue hills without artwork.
 * Replace this SVG to change the placeholder everywhere; never represents a
 * particular mountain and never initiates a paid generation.
 */
export const MOUNTAIN_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="620" viewBox="0 0 960 620">
<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#173e40"/><stop offset="1" stop-color="#8baba0"/></linearGradient><linearGradient id="stone" x2="1" y2="1"><stop stop-color="#d8d6c5"/><stop offset="1" stop-color="#777f75"/></linearGradient></defs>
<rect width="960" height="620" fill="url(#sky)"/>
<path d="M0 345L145 245 285 330 465 205 640 340 820 250 960 325V620H0Z" fill="#385956"/>
<path d="M0 440L230 345 420 420 655 320 960 410V620H0Z" fill="#253f3b"/>
<path d="M0 535Q290 440 520 475T960 470V620H0Z" fill="#152e29"/>
<ellipse cx="495" cy="542" rx="135" ry="24" fill="#0c2421" opacity=".55"/>
<path d="M450 324H526L558 531H421Z" fill="url(#stone)"/>
<path d="M526 324L558 531 579 515 549 321Z" fill="#66716a"/>
<path d="M450 324L472 311H549L526 324Z" fill="#e2dfcf"/>
<rect x="480" y="302" width="39" height="13" rx="3" fill="#63706b"/>
<path d="M444 449L538 449M451 398L531 398" stroke="#879287" opacity=".35"/>
</svg>`;
