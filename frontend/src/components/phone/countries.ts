export interface Country {
	code: string; // ISO 3166-1 alpha-2
	name: string; // Country name
	dial: string; // International dial code
	emoji: string; // Flag emoji
	format?: string; // Optional phone format
}

export const countries: Country[] = [
	// Major English-speaking countries
	{ code: 'us', name: 'United States', dial: '+1', emoji: '🇺🇸', format: '(###) ###-####' },
	{ code: 'ca', name: 'Canada', dial: '+1', emoji: '🇨🇦', format: '(###) ###-####' },
	{ code: 'gb', name: 'United Kingdom', dial: '+44', emoji: '🇬🇧' },
	{ code: 'au', name: 'Australia', dial: '+61', emoji: '🇦🇺' },
	{ code: 'nz', name: 'New Zealand', dial: '+64', emoji: '🇳🇿' },

	// Western Europe
	{ code: 'de', name: 'Germany', dial: '+49', emoji: '🇩🇪' },
	{ code: 'fr', name: 'France', dial: '+33', emoji: '🇫🇷' },
	{ code: 'es', name: 'Spain', dial: '+34', emoji: '🇪🇸' },
	{ code: 'it', name: 'Italy', dial: '+39', emoji: '🇮🇹' },
	{ code: 'nl', name: 'Netherlands', dial: '+31', emoji: '🇳🇱' },
	{ code: 'be', name: 'Belgium', dial: '+32', emoji: '🇧🇪' },
	{ code: 'ch', name: 'Switzerland', dial: '+41', emoji: '🇨🇭' },
	{ code: 'at', name: 'Austria', dial: '+43', emoji: '🇦🇹' },
	{ code: 'ie', name: 'Ireland', dial: '+353', emoji: '🇮🇪' },
	{ code: 'pt', name: 'Portugal', dial: '+351', emoji: '🇵🇹' },
	{ code: 'lu', name: 'Luxembourg', dial: '+352', emoji: '🇱🇺' },
	{ code: 'mc', name: 'Monaco', dial: '+377', emoji: '🇲🇨' },
	{ code: 'ad', name: 'Andorra', dial: '+376', emoji: '🇦🇩' },
	{ code: 'li', name: 'Liechtenstein', dial: '+423', emoji: '🇱🇮' },
	{ code: 'sm', name: 'San Marino', dial: '+378', emoji: '🇸🇲' },
	{ code: 'va', name: 'Vatican City', dial: '+379', emoji: '🇻🇦' },
	{ code: 'gi', name: 'Gibraltar', dial: '+350', emoji: '🇬🇮' },

	// Nordic countries
	{ code: 'se', name: 'Sweden', dial: '+46', emoji: '🇸🇪' },
	{ code: 'no', name: 'Norway', dial: '+47', emoji: '🇳🇴' },
	{ code: 'dk', name: 'Denmark', dial: '+45', emoji: '🇩🇰' },
	{ code: 'fi', name: 'Finland', dial: '+358', emoji: '🇫🇮' },
	{ code: 'is', name: 'Iceland', dial: '+354', emoji: '🇮🇸' },
	{ code: 'fo', name: 'Faroe Islands', dial: '+298', emoji: '🇫🇴' },
	{ code: 'gl', name: 'Greenland', dial: '+299', emoji: '🇬🇱' },
	{ code: 'ax', name: 'Åland Islands', dial: '+358', emoji: '🇦🇽' },
	{ code: 'sj', name: 'Svalbard and Jan Mayen', dial: '+47', emoji: '🇸🇯' },

	// Central Europe
	{ code: 'pl', name: 'Poland', dial: '+48', emoji: '🇵🇱' },
	{ code: 'cz', name: 'Czech Republic', dial: '+420', emoji: '🇨🇿' },
	{ code: 'sk', name: 'Slovakia', dial: '+421', emoji: '🇸🇰' },
	{ code: 'hu', name: 'Hungary', dial: '+36', emoji: '🇭🇺' },

	// Eastern Europe
	{ code: 'ro', name: 'Romania', dial: '+40', emoji: '🇷🇴' },
	{ code: 'bg', name: 'Bulgaria', dial: '+359', emoji: '🇧🇬' },
	{ code: 'al', name: 'Albania', dial: '+355', emoji: '🇦🇱' },
	{ code: 'mk', name: 'North Macedonia', dial: '+389', emoji: '🇲🇰' },
	{ code: 'gr', name: 'Greece', dial: '+30', emoji: '🇬🇷' },
	{ code: 'cy', name: 'Cyprus', dial: '+357', emoji: '🇨🇾' },
	{ code: 'mt', name: 'Malta', dial: '+356', emoji: '🇲🇹' },

	// Balkans and Former Yugoslavia
	{ code: 'hr', name: 'Croatia', dial: '+385', emoji: '🇭🇷' },
	{ code: 'rs', name: 'Serbia', dial: '+381', emoji: '🇷🇸' },
	{ code: 'si', name: 'Slovenia', dial: '+386', emoji: '🇸🇮' },
	{ code: 'ba', name: 'Bosnia and Herzegovina', dial: '+387', emoji: '🇧🇦' },
	{ code: 'me', name: 'Montenegro', dial: '+382', emoji: '🇲🇪' },

	// Baltic States
	{ code: 'ee', name: 'Estonia', dial: '+372', emoji: '🇪🇪' },
	{ code: 'lv', name: 'Latvia', dial: '+371', emoji: '🇱🇻' },
	{ code: 'lt', name: 'Lithuania', dial: '+370', emoji: '🇱🇹' },

	// Former Soviet Union
	{ code: 'ru', name: 'Russia', dial: '+7', emoji: '🇷🇺' },
	{ code: 'ua', name: 'Ukraine', dial: '+380', emoji: '🇺🇦' },
	{ code: 'by', name: 'Belarus', dial: '+375', emoji: '🇧🇾' },
	{ code: 'md', name: 'Moldova', dial: '+373', emoji: '🇲🇩' },
	{ code: 'kz', name: 'Kazakhstan', dial: '+7', emoji: '🇰🇿' },
	{ code: 'uz', name: 'Uzbekistan', dial: '+998', emoji: '🇺🇿' },
	{ code: 'tm', name: 'Turkmenistan', dial: '+993', emoji: '🇹🇲' },
	{ code: 'tj', name: 'Tajikistan', dial: '+992', emoji: '🇹🇯' },
	{ code: 'kg', name: 'Kyrgyzstan', dial: '+996', emoji: '🇰🇬' },
	{ code: 'am', name: 'Armenia', dial: '+374', emoji: '🇦🇲' },
	{ code: 'az', name: 'Azerbaijan', dial: '+994', emoji: '🇦🇿' },
	{ code: 'ge', name: 'Georgia', dial: '+995', emoji: '🇬🇪' },

	// East Asia
	{ code: 'jp', name: 'Japan', dial: '+81', emoji: '🇯🇵' },
	{ code: 'kr', name: 'South Korea', dial: '+82', emoji: '🇰🇷' },
	{ code: 'kp', name: 'North Korea', dial: '+850', emoji: '🇰🇵' },
	{ code: 'cn', name: 'China', dial: '+86', emoji: '🇨🇳' },
	{ code: 'hk', name: 'Hong Kong', dial: '+852', emoji: '🇭🇰' },
	{ code: 'mo', name: 'Macau', dial: '+853', emoji: '🇲🇴' },
	{ code: 'tw', name: 'Taiwan', dial: '+886', emoji: '🇹🇼' },
	{ code: 'mn', name: 'Mongolia', dial: '+976', emoji: '🇲🇳' },

	// South Asia
	{ code: 'in', name: 'India', dial: '+91', emoji: '🇮🇳' },
	{ code: 'pk', name: 'Pakistan', dial: '+92', emoji: '🇵🇰' },
	{ code: 'bd', name: 'Bangladesh', dial: '+880', emoji: '🇧🇩' },
	{ code: 'lk', name: 'Sri Lanka', dial: '+94', emoji: '🇱🇰' },
	{ code: 'np', name: 'Nepal', dial: '+977', emoji: '🇳🇵' },
	{ code: 'bt', name: 'Bhutan', dial: '+975', emoji: '🇧🇹' },
	{ code: 'mv', name: 'Maldives', dial: '+960', emoji: '🇲🇻' },
	{ code: 'af', name: 'Afghanistan', dial: '+93', emoji: '🇦🇫' },

	// Southeast Asia
	{ code: 'sg', name: 'Singapore', dial: '+65', emoji: '🇸🇬' },
	{ code: 'my', name: 'Malaysia', dial: '+60', emoji: '🇲🇾' },
	{ code: 'th', name: 'Thailand', dial: '+66', emoji: '🇹🇭' },
	{ code: 'ph', name: 'Philippines', dial: '+63', emoji: '🇵🇭' },
	{ code: 'id', name: 'Indonesia', dial: '+62', emoji: '🇮🇩' },
	{ code: 'vn', name: 'Vietnam', dial: '+84', emoji: '🇻🇳' },
	{ code: 'mm', name: 'Myanmar', dial: '+95', emoji: '🇲🇲' },
	{ code: 'kh', name: 'Cambodia', dial: '+855', emoji: '🇰🇭' },
	{ code: 'la', name: 'Laos', dial: '+856', emoji: '🇱🇦' },
	{ code: 'bn', name: 'Brunei', dial: '+673', emoji: '🇧🇳' },
	{ code: 'tl', name: 'Timor-Leste', dial: '+670', emoji: '🇹🇱' },

	// Middle East
	{ code: 'tr', name: 'Turkey', dial: '+90', emoji: '🇹🇷' },
	{ code: 'il', name: 'Israel', dial: '+972', emoji: '🇮🇱' },
	{ code: 'ps', name: 'Palestinian Territory', dial: '+970', emoji: '🇵🇸' },
	{ code: 'ae', name: 'United Arab Emirates', dial: '+971', emoji: '🇦🇪' },
	{ code: 'sa', name: 'Saudi Arabia', dial: '+966', emoji: '🇸🇦' },
	{ code: 'bh', name: 'Bahrain', dial: '+973', emoji: '🇧🇭' },
	{ code: 'iq', name: 'Iraq', dial: '+964', emoji: '🇮🇶' },
	{ code: 'ir', name: 'Iran', dial: '+98', emoji: '🇮🇷' },
	{ code: 'jo', name: 'Jordan', dial: '+962', emoji: '🇯🇴' },
	{ code: 'kw', name: 'Kuwait', dial: '+965', emoji: '🇰🇼' },
	{ code: 'lb', name: 'Lebanon', dial: '+961', emoji: '🇱🇧' },
	{ code: 'om', name: 'Oman', dial: '+968', emoji: '🇴🇲' },
	{ code: 'qa', name: 'Qatar', dial: '+974', emoji: '🇶🇦' },
	{ code: 'sy', name: 'Syria', dial: '+963', emoji: '🇸🇾' },
	{ code: 'ye', name: 'Yemen', dial: '+967', emoji: '🇾🇪' },

	// South America
	{ code: 'br', name: 'Brazil', dial: '+55', emoji: '🇧🇷' },
	{ code: 'ar', name: 'Argentina', dial: '+54', emoji: '🇦🇷' },
	{ code: 'cl', name: 'Chile', dial: '+56', emoji: '🇨🇱' },
	{ code: 'co', name: 'Colombia', dial: '+57', emoji: '🇨🇴' },
	{ code: 'pe', name: 'Peru', dial: '+51', emoji: '🇵🇪' },
	{ code: 've', name: 'Venezuela', dial: '+58', emoji: '🇻🇪' },
	{ code: 'ec', name: 'Ecuador', dial: '+593', emoji: '🇪🇨' },
	{ code: 'bo', name: 'Bolivia', dial: '+591', emoji: '🇧🇴' },
	{ code: 'py', name: 'Paraguay', dial: '+595', emoji: '🇵🇾' },
	{ code: 'uy', name: 'Uruguay', dial: '+598', emoji: '🇺🇾' },
	{ code: 'gf', name: 'French Guiana', dial: '+594', emoji: '🇬🇫' },
	{ code: 'sr', name: 'Suriname', dial: '+597', emoji: '🇸🇷' },
	{ code: 'gy', name: 'Guyana', dial: '+592', emoji: '🇬🇾' },
	{ code: 'fk', name: 'Falkland Islands', dial: '+500', emoji: '🇫🇰' },
	{ code: 'gs', name: 'South Georgia', dial: '+500', emoji: '🇬🇸' },

	// Central America
	{ code: 'mx', name: 'Mexico', dial: '+52', emoji: '🇲🇽' },
	{ code: 'gt', name: 'Guatemala', dial: '+502', emoji: '🇬🇹' },
	{ code: 'bz', name: 'Belize', dial: '+501', emoji: '🇧🇿' },
	{ code: 'sv', name: 'El Salvador', dial: '+503', emoji: '🇸🇻' },
	{ code: 'hn', name: 'Honduras', dial: '+504', emoji: '🇭🇳' },
	{ code: 'ni', name: 'Nicaragua', dial: '+505', emoji: '🇳🇮' },
	{ code: 'cr', name: 'Costa Rica', dial: '+506', emoji: '🇨🇷' },
	{ code: 'pa', name: 'Panama', dial: '+507', emoji: '🇵🇦' },

	// Caribbean
	{ code: 'cu', name: 'Cuba', dial: '+53', emoji: '🇨🇺' },
	{ code: 'ht', name: 'Haiti', dial: '+509', emoji: '🇭🇹' },
	{ code: 'jm', name: 'Jamaica', dial: '+1-876', emoji: '🇯🇲' },
	{ code: 'do', name: 'Dominican Republic', dial: '+1-809', emoji: '🇩🇴' },
	{ code: 'pr', name: 'Puerto Rico', dial: '+1-787', emoji: '🇵🇷' },
	{ code: 'tt', name: 'Trinidad and Tobago', dial: '+1-868', emoji: '🇹🇹' },
	{ code: 'bb', name: 'Barbados', dial: '+1-246', emoji: '🇧🇧' },
	{ code: 'bs', name: 'Bahamas', dial: '+1-242', emoji: '🇧🇸' },
	{ code: 'bm', name: 'Bermuda', dial: '+1-441', emoji: '🇧🇲' },
	{ code: 'gd', name: 'Grenada', dial: '+1-473', emoji: '🇬🇩' },
	{ code: 'lc', name: 'Saint Lucia', dial: '+1-758', emoji: '🇱🇨' },
	{ code: 'vc', name: 'Saint Vincent', dial: '+1-784', emoji: '🇻🇨' },
	{ code: 'ag', name: 'Antigua and Barbuda', dial: '+1-268', emoji: '🇦🇬' },
	{ code: 'dm', name: 'Dominica', dial: '+1-767', emoji: '🇩🇲' },
	{ code: 'kn', name: 'Saint Kitts and Nevis', dial: '+1-869', emoji: '🇰🇳' },
	{ code: 'ky', name: 'Cayman Islands', dial: '+1-345', emoji: '🇰🇾' },
	{ code: 'vg', name: 'British Virgin Islands', dial: '+1-284', emoji: '🇻🇬' },
	{ code: 'vi', name: 'US Virgin Islands', dial: '+1-340', emoji: '🇻🇮' },
	{ code: 'ai', name: 'Anguilla', dial: '+1-264', emoji: '🇦🇮' },
	{ code: 'ms', name: 'Montserrat', dial: '+1-664', emoji: '🇲🇸' },
	{ code: 'tc', name: 'Turks and Caicos', dial: '+1-649', emoji: '🇹🇨' },
	{ code: 'aw', name: 'Aruba', dial: '+297', emoji: '🇦🇼' },
	{ code: 'cw', name: 'Curaçao', dial: '+599', emoji: '🇨🇼' },
	{ code: 'sx', name: 'Sint Maarten', dial: '+1-721', emoji: '🇸🇽' },
	{ code: 'mf', name: 'Saint Martin', dial: '+590', emoji: '🇲🇫' },
	{ code: 'bl', name: 'Saint Barthélemy', dial: '+590', emoji: '🇧🇱' },
	{ code: 'gp', name: 'Guadeloupe', dial: '+590', emoji: '🇬🇵' },
	{ code: 'mq', name: 'Martinique', dial: '+596', emoji: '🇲🇶' },

	// North Africa
	{ code: 'ma', name: 'Morocco', dial: '+212', emoji: '🇲🇦' },
	{ code: 'dz', name: 'Algeria', dial: '+213', emoji: '🇩🇿' },
	{ code: 'tn', name: 'Tunisia', dial: '+216', emoji: '🇹🇳' },
	{ code: 'ly', name: 'Libya', dial: '+218', emoji: '🇱🇾' },
	{ code: 'eg', name: 'Egypt', dial: '+20', emoji: '🇪🇬' },
	{ code: 'eh', name: 'Western Sahara', dial: '+212', emoji: '🇪🇭' },
	{ code: 'sd', name: 'Sudan', dial: '+249', emoji: '🇸🇩' },
	{ code: 'ss', name: 'South Sudan', dial: '+211', emoji: '🇸🇸' },

	// West Africa
	{ code: 'mr', name: 'Mauritania', dial: '+222', emoji: '🇲🇷' },
	{ code: 'ml', name: 'Mali', dial: '+223', emoji: '🇲🇱' },
	{ code: 'sn', name: 'Senegal', dial: '+221', emoji: '🇸🇳' },
	{ code: 'gm', name: 'Gambia', dial: '+220', emoji: '🇬🇲' },
	{ code: 'gw', name: 'Guinea-Bissau', dial: '+245', emoji: '🇬🇼' },
	{ code: 'gn', name: 'Guinea', dial: '+224', emoji: '🇬🇳' },
	{ code: 'sl', name: 'Sierra Leone', dial: '+232', emoji: '🇸🇱' },
	{ code: 'lr', name: 'Liberia', dial: '+231', emoji: '🇱🇷' },
	{ code: 'ci', name: 'Ivory Coast', dial: '+225', emoji: '🇨🇮' },
	{ code: 'bf', name: 'Burkina Faso', dial: '+226', emoji: '🇧🇫' },
	{ code: 'gh', name: 'Ghana', dial: '+233', emoji: '🇬🇭' },
	{ code: 'tg', name: 'Togo', dial: '+228', emoji: '🇹🇬' },
	{ code: 'bj', name: 'Benin', dial: '+229', emoji: '🇧🇯' },
	{ code: 'ne', name: 'Niger', dial: '+227', emoji: '🇳🇪' },
	{ code: 'ng', name: 'Nigeria', dial: '+234', emoji: '🇳🇬' },
	{ code: 'cv', name: 'Cape Verde', dial: '+238', emoji: '🇨🇻' },
	{ code: 'st', name: 'São Tomé and Príncipe', dial: '+239', emoji: '🇸🇹' },

	// Central Africa
	{ code: 'td', name: 'Chad', dial: '+235', emoji: '🇹🇩' },
	{ code: 'cf', name: 'Central African Republic', dial: '+236', emoji: '🇨🇫' },
	{ code: 'cm', name: 'Cameroon', dial: '+237', emoji: '🇨🇲' },
	{ code: 'gq', name: 'Equatorial Guinea', dial: '+240', emoji: '🇬🇶' },
	{ code: 'ga', name: 'Gabon', dial: '+241', emoji: '🇬🇦' },
	{ code: 'cg', name: 'Congo', dial: '+242', emoji: '🇨🇬' },
	{ code: 'cd', name: 'DR Congo', dial: '+243', emoji: '🇨🇩' },
	{ code: 'ao', name: 'Angola', dial: '+244', emoji: '🇦🇴' },

	// East Africa
	{ code: 'et', name: 'Ethiopia', dial: '+251', emoji: '🇪🇹' },
	{ code: 'er', name: 'Eritrea', dial: '+291', emoji: '🇪🇷' },
	{ code: 'dj', name: 'Djibouti', dial: '+253', emoji: '🇩🇯' },
	{ code: 'so', name: 'Somalia', dial: '+252', emoji: '🇸🇴' },
	{ code: 'ke', name: 'Kenya', dial: '+254', emoji: '🇰🇪' },
	{ code: 'ug', name: 'Uganda', dial: '+256', emoji: '🇺🇬' },
	{ code: 'rw', name: 'Rwanda', dial: '+250', emoji: '🇷🇼' },
	{ code: 'bi', name: 'Burundi', dial: '+257', emoji: '🇧🇮' },
	{ code: 'tz', name: 'Tanzania', dial: '+255', emoji: '🇹🇿' },

	// Southern Africa
	{ code: 'za', name: 'South Africa', dial: '+27', emoji: '🇿🇦' },
	{ code: 'na', name: 'Namibia', dial: '+264', emoji: '🇳🇦' },
	{ code: 'bw', name: 'Botswana', dial: '+267', emoji: '🇧🇼' },
	{ code: 'zw', name: 'Zimbabwe', dial: '+263', emoji: '🇿🇼' },
	{ code: 'zm', name: 'Zambia', dial: '+260', emoji: '🇿🇲' },
	{ code: 'mw', name: 'Malawi', dial: '+265', emoji: '🇲🇼' },
	{ code: 'mz', name: 'Mozambique', dial: '+258', emoji: '🇲🇿' },
	{ code: 'ls', name: 'Lesotho', dial: '+266', emoji: '🇱🇸' },
	{ code: 'sz', name: 'Eswatini', dial: '+268', emoji: '🇸🇿' },
	{ code: 'mg', name: 'Madagascar', dial: '+261', emoji: '🇲🇬' },
	{ code: 'km', name: 'Comoros', dial: '+269', emoji: '🇰🇲' },
	{ code: 'mu', name: 'Mauritius', dial: '+230', emoji: '🇲🇺' },
	{ code: 'sc', name: 'Seychelles', dial: '+248', emoji: '🇸🇨' },
	{ code: 're', name: 'Réunion', dial: '+262', emoji: '🇷🇪' },
	{ code: 'yt', name: 'Mayotte', dial: '+262', emoji: '🇾🇹' },
	{ code: 'sh', name: 'Saint Helena', dial: '+290', emoji: '🇸🇭' },

	// Pacific Islands
	{ code: 'fj', name: 'Fiji', dial: '+679', emoji: '🇫🇯' },
	{ code: 'pg', name: 'Papua New Guinea', dial: '+675', emoji: '🇵🇬' },
	{ code: 'nc', name: 'New Caledonia', dial: '+687', emoji: '🇳🇨' },
	{ code: 'pf', name: 'French Polynesia', dial: '+689', emoji: '🇵🇫' },
	{ code: 'ws', name: 'Samoa', dial: '+685', emoji: '🇼🇸' },
	{ code: 'to', name: 'Tonga', dial: '+676', emoji: '🇹🇴' },
	{ code: 'vu', name: 'Vanuatu', dial: '+678', emoji: '🇻🇺' },
	{ code: 'sb', name: 'Solomon Islands', dial: '+677', emoji: '🇸🇧' },
	{ code: 'ki', name: 'Kiribati', dial: '+686', emoji: '🇰🇮' },
	{ code: 'tv', name: 'Tuvalu', dial: '+688', emoji: '🇹🇻' },
	{ code: 'nr', name: 'Nauru', dial: '+674', emoji: '🇳🇷' },
	{ code: 'pw', name: 'Palau', dial: '+680', emoji: '🇵🇼' },
	{ code: 'mh', name: 'Marshall Islands', dial: '+692', emoji: '🇲🇭' },
	{ code: 'fm', name: 'Micronesia', dial: '+691', emoji: '🇫🇲' },
	{ code: 'ck', name: 'Cook Islands', dial: '+682', emoji: '🇨🇰' },
	{ code: 'nu', name: 'Niue', dial: '+683', emoji: '🇳🇺' },
	{ code: 'tk', name: 'Tokelau', dial: '+690', emoji: '🇹🇰' },
	{ code: 'wf', name: 'Wallis and Futuna', dial: '+681', emoji: '🇼🇫' },
	{ code: 'pn', name: 'Pitcairn Islands', dial: '+870', emoji: '🇵🇳' },

	// US Territories & Dependencies
	{ code: 'as', name: 'American Samoa', dial: '+1-684', emoji: '🇦🇸' },
	{ code: 'gu', name: 'Guam', dial: '+1-671', emoji: '🇬🇺' },
	{ code: 'mp', name: 'Northern Mariana Islands', dial: '+1-670', emoji: '🇲🇵' },
	{ code: 'um', name: 'US Minor Outlying Islands', dial: '+1', emoji: '🇺🇲' },

	// UK Territories
	{ code: 'gg', name: 'Guernsey', dial: '+44-1481', emoji: '🇬🇬' },
	{ code: 'je', name: 'Jersey', dial: '+44-1534', emoji: '🇯🇪' },
	{ code: 'im', name: 'Isle of Man', dial: '+44-1624', emoji: '🇮🇲' },

	// Australian Territories
	{ code: 'cx', name: 'Christmas Island', dial: '+61', emoji: '🇨🇽' },
	{ code: 'cc', name: 'Cocos (Keeling) Islands', dial: '+61', emoji: '🇨🇨' },
	{ code: 'nf', name: 'Norfolk Island', dial: '+672', emoji: '🇳🇫' },

	// French Territories
	{ code: 'pm', name: 'Saint Pierre and Miquelon', dial: '+508', emoji: '🇵🇲' },
	{ code: 'tf', name: 'French Southern Territories', dial: '+262', emoji: '🇹🇫' },

	// Antarctic & Remote
	{ code: 'aq', name: 'Antarctica', dial: '+672', emoji: '🇦🇶' },
	{ code: 'bv', name: 'Bouvet Island', dial: '+47', emoji: '🇧🇻' },
	{ code: 'hm', name: 'Heard and McDonald Islands', dial: '+672', emoji: '🇭🇲' },
	{ code: 'io', name: 'British Indian Ocean Territory', dial: '+246', emoji: '🇮🇴' },
];

/**
 * Get country by ISO code
 */
export function getCountryByCode(code: string): Country | undefined {
	return countries.find((c) => c.code.toLowerCase() === code.toLowerCase());
}

/**
 * Get country by dial code
 */
export function getCountryByDialCode(dialCode: string): Country | undefined {
	return countries.find((c) => c.dial === dialCode);
}

/**
 * Search countries by name or dial code
 */
export function searchCountries(query: string): Country[] {
	const lowerQuery = query.toLowerCase();
	return countries.filter(
		(c) => c.name.toLowerCase().includes(lowerQuery) || c.dial.includes(query) || c.code.toLowerCase().includes(lowerQuery),
	);
}
