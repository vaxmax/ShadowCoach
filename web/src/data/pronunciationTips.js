// Pronunciation tips for words commonly mispronounced by Spanish speakers.
// Shown in the ComparisonView tooltip when a word is hovered.
// Key = lowercase, stripped of punctuation.

const TIPS = {
  // ── TH unvoiced /θ/ ────────────────────────────────────────────────────
  'think':      'Unvoiced /θ/ — tongue tip lightly between teeth, breathe out without voicing',
  'thought':    'Unvoiced /θ/ — tongue between teeth, exhale; the "-ought" sounds like "awt"',
  'through':    'Unvoiced /θ/ + silent "gh" — "θruː" sounds like "throo"',
  'three':      'Unvoiced /θ/ — tongue between teeth, then the /r/ comes in',
  'thirty':     'Unvoiced /θ/ at the start, then flap-t in the middle',
  'thousand':   'Unvoiced /θ/ — tongue between teeth before the "ow" vowel',
  'thank':      'Unvoiced /θ/ — not /t/ or /f/, tongue must touch upper teeth',
  'thin':       'Unvoiced /θ/ — lighter than "tin"',
  'thing':      'Unvoiced /θ/ — same start as "think"',
  'third':      'Unvoiced /θ/ — then the American /r/ after the vowel',
  'health':     'Final unvoiced /θ/ — ends with tongue between teeth',
  'month':      'Final unvoiced /θ/ — easy to drop, but it matters',
  'truth':      'Final unvoiced /θ/ — same ending as "month"',
  'worth':      'Final unvoiced /θ/ — ends with tongue between teeth',
  'both':       'Final unvoiced /θ/ — do not end with /f/ or /t/',
  'path':       'Final unvoiced /θ/ — British vs American: /pɑːθ/ vs /pæθ/',
  'math':       'Final unvoiced /θ/ — do not say "mats"',
  'breath':     'Final unvoiced /θ/ (noun) — "breathe" (verb) has voiced /ð/',
  'teeth':      'Final unvoiced /θ/ — "tooth" → "teeth", irregular plural',
  'method':     'Unvoiced /θ/ in middle — "meh-thud"',
  'author':     'Unvoiced /θ/ — "aw-ther"',

  // ── TH voiced /ð/ ──────────────────────────────────────────────────────
  'the':        'Voiced /ð/ — tongue between teeth with vocal cord vibration',
  'this':       'Voiced /ð/ — same as "the" but with short-i vowel after',
  'that':       'Voiced /ð/ — starts with tongue-between-teeth, voiced',
  'they':       'Voiced /ð/ — sounds like "ðey", not "zey" or "dey"',
  'them':       'Voiced /ð/ — do not replace with /d/ or /z/',
  'their':      'Voiced /ð/ — homophones: their/there/they\'re all sound the same',
  'there':      'Voiced /ð/ — same as "their", context tells them apart',
  'these':      'Voiced /ð/ + long /iː/ — "ðiːz"',
  'those':      'Voiced /ð/ — "ðoʊz"',
  'then':       'Voiced /ð/ — not "den" or "zen"',
  'than':       'Voiced /ð/ — often unstressed in fast speech: "better than that"',
  'though':     'Voiced /ð/ + silent "gh" — sounds like "ðoʊ"',
  'whether':    'Voiced /ð/ in middle — "weh-ðer", not "weh-ter"',
  'together':   'Voiced /ð/ in middle — "tuh-geh-ðer"',
  'other':      'Voiced /ð/ — "uh-ðer", not "oh-ter"',
  'rather':     'Voiced /ð/ — "rah-ðer"',
  'further':    'Voiced /ð/ — American /r/ + voiced TH: "fur-ðer"',
  'either':     'Voiced /ð/ — two pronunciations: "ee-ðer" or "eye-ðer"',
  'breathe':    'Voiced /ð/ at end (verb) — "briːð" (vs. noun "breath" /θ/)',
  'smooth':     'Voiced /ð/ at end — "smuːð"',
  'with':       'Can be voiced /ð/ or unvoiced /θ/ — either is acceptable',

  // ── V sound /v/ ────────────────────────────────────────────────────────
  'very':       '/v/ — upper teeth lightly on lower lip; not /b/',
  'voice':      '/v/ at start — do not replace with /b/',
  'value':      '/v/ — "val-yoo", upper teeth touch lower lip',
  'visit':      '/v/ at start + short-i: "vih-zit"',
  'video':      '/v/ at start — "vid-ee-oh"',
  'vital':      '/v/ — "vai-tul", not "bai-tul"',
  'vivid':      'Two /v/ sounds — "vih-vid"',
  'vibrant':    '/v/ at start — "vai-brent"',
  'believe':    'Final /v/ — "buh-leev", do not drop the V',
  'give':       'Final /v/ — "giv", not "gib"',
  'live':       'Verb /lɪv/ vs adjective/noun /laɪv/ — context matters',
  'love':       'Final /v/ — "luv", not "lub"',
  'move':       'Final /v/ — "muuv", not "muub"',
  'have':       '/v/ in citation form; often reduced to /həv/ in fast speech',
  'over':       '/v/ in middle — "oh-ver"',
  'never':      '/v/ in middle — "nev-er"',
  'every':      '/v/ in middle — "ev-ree"',
  'seven':      '/v/ in middle — "sev-en"',
  'above':      'Final /v/ — "uh-buv"',
  'involve':    'Final /v/ — "in-volv"',

  // ── W sound /w/ ────────────────────────────────────────────────────────
  'word':       '/w/ + the "ur" vowel /ɜːr/ — "wurd", not "vord" or "gord"',
  'work':       '/w/ + "ur" + /k/ — "wurk"',
  'world':      '/w/ + "url" — "wurld"',
  'want':       '/w/ + "aw" vowel — "wont" (American) or "wont"',
  'water':      '/w/ — "waw-ter" (American flap-t)',
  'walk':       '/w/ + "aw" + silent L — "wawk"',
  'watch':      '/w/ + "aw" + /tʃ/ — "wotch"',
  'woman':      '/w/ + "uh" — "wuh-men" (irregular plural: women = "wih-men")',
  'wonder':     '/w/ — "wun-der"',
  'would':      '/w/ + "uh" + silent L — "wud"',
  'could':      'Silent /k/ + "uh" + silent L — "kud"; no W sound here',

  // ── Short-i /ɪ/ ────────────────────────────────────────────────────────
  'ship':       'Short /ɪ/ — "shɪp", not "sheep" /iː/',
  'bit':        'Short /ɪ/ — "bɪt", not "beat" /iː/',
  'hit':        'Short /ɪ/ — "hɪt", not "heat"',
  'sit':        'Short /ɪ/ — "sɪt", not "seat"',
  'big':        'Short /ɪ/ — "bɪg", not "beeg"',
  'still':      'Short /ɪ/ — "stɪl", not "steel"',
  'fill':       'Short /ɪ/ — "fɪl", distinct from "feel" /iː/',
  'will':       'Short /ɪ/ — "wɪl", not "weel"',
  'film':       'Short /ɪ/ — "fɪlm"; the L is pronounced before M',
  'bridge':     'Short /ɪ/ — "brɪdʒ"',

  // ── Other common tricky words ──────────────────────────────────────────
  'right':      '/r/ — American /r/ is pronounced with curled tongue; not a trill',
  'rhythm':     '/r/ at start, silent H — "rɪð-um"; no vowel before the /r/',
  'thoroughly': 'Unvoiced /θ/ — "θɜːr-uh-lee"; the "gh" is completely silent',
  'comfortable':'Often reduced: "comf-ter-bul" (3 syllables) in natural speech',
  'vegetable':  'Often reduced: "vej-tuh-bul" (3 syllables) in natural speech',
  'interesting':'Often reduced: "int-res-ting" (3 syllables) in natural speech',
  'probably':   'Often reduced: "prob-lee" in fast speech',
  'should':     'Silent L — "shud"',
  'often':      'The L is usually silent in American English — "off-en"',
  'wednesday':  'Middle syllable reduced: "wenz-dee", not "wed-nes-day"',
  'february':   'Often reduced: "feb-yoo-air-ee" in American English',
}

/**
 * Returns a tip string for the given word, or null if none exists.
 * @param {string} word — raw word from results
 */
export function getTip(word) {
  const key = word.toLowerCase().replace(/[^a-z']/g, '')
  return TIPS[key] ?? null
}
