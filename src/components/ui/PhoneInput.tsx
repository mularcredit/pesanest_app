"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PiCaretDown, PiCheck, PiMagnifyingGlass } from "react-icons/pi";
import { motion, AnimatePresence } from "framer-motion";

interface Country {
    name: string;
    code: string;
    dialCode: string;
    flag: string;
}

const COUNTRIES: Country[] = [
    { name: "Afghanistan", code: "AF", dialCode: "+93", flag: "🇦🇫" },
    { name: "Albania", code: "AL", dialCode: "+355", flag: "🇦🇱" },
    { name: "Algeria", code: "DZ", dialCode: "+213", flag: "🇩🇿" },
    { name: "American Samoa", code: "AS", dialCode: "+1-684", flag: "🇦🇸" },
    { name: "Andorra", code: "AD", dialCode: "+376", flag: "🇦🇩" },
    { name: "Angola", code: "AO", dialCode: "+244", flag: "🇦🇴" },
    { name: "Anguilla", code: "AI", dialCode: "+1-264", flag: "🇦🇮" },
    { name: "Antarctica", code: "AQ", dialCode: "+672", flag: "🇦🇶" },
    { name: "Antigua and Barbuda", code: "AG", dialCode: "+1-268", flag: "🇦🇬" },
    { name: "Argentina", code: "AR", dialCode: "+54", flag: "🇦🇷" },
    { name: "Armenia", code: "AM", dialCode: "+374", flag: "🇦🇲" },
    { name: "Aruba", code: "AW", dialCode: "+297", flag: "🇦🇼" },
    { name: "Australia", code: "AU", dialCode: "+61", flag: "🇦🇺" },
    { name: "Austria", code: "AT", dialCode: "+43", flag: "🇦🇹" },
    { name: "Azerbaijan", code: "AZ", dialCode: "+994", flag: "🇦🇿" },
    { name: "Bahamas", code: "BS", dialCode: "+1-242", flag: "🇧🇸" },
    { name: "Bahrain", code: "BH", dialCode: "+973", flag: "🇧🇭" },
    { name: "Bangladesh", code: "BD", dialCode: "+880", flag: "🇧🇩" },
    { name: "Barbados", code: "BB", dialCode: "+1-246", flag: "🇧🇧" },
    { name: "Belarus", code: "BY", dialCode: "+375", flag: "🇧🇾" },
    { name: "Belgium", code: "BE", dialCode: "+32", flag: "🇧🇪" },
    { name: "Belize", code: "BZ", dialCode: "+501", flag: "🇧🇿" },
    { name: "Benin", code: "BJ", dialCode: "+229", flag: "🇧🇯" },
    { name: "Bermuda", code: "BM", dialCode: "+1-441", flag: "🇧🇲" },
    { name: "Bhutan", code: "BT", dialCode: "+975", flag: "🇧🇹" },
    { name: "Bolivia", code: "BO", dialCode: "+591", flag: "🇧🇴" },
    { name: "Bosnia and Herzegovina", code: "BA", dialCode: "+387", flag: "🇧🇦" },
    { name: "Botswana", code: "BW", dialCode: "+267", flag: "🇧🇼" },
    { name: "Brazil", code: "BR", dialCode: "+55", flag: "🇧🇷" },
    { name: "British Indian Ocean Territory", code: "IO", dialCode: "+246", flag: "🇮🇴" },
    { name: "British Virgin Islands", code: "VG", dialCode: "+1-284", flag: "🇻🇬" },
    { name: "Brunei", code: "BN", dialCode: "+673", flag: "🇧🇳" },
    { name: "Bulgaria", code: "BG", dialCode: "+359", flag: "🇧🇬" },
    { name: "Burkina Faso", code: "BF", dialCode: "+226", flag: "🇧🇫" },
    { name: "Burundi", code: "BI", dialCode: "+257", flag: "🇧🇮" },
    { name: "Cambodia", code: "KH", dialCode: "+855", flag: "🇰🇭" },
    { name: "Cameroon", code: "CM", dialCode: "+237", flag: "🇨🇲" },
    { name: "Canada", code: "CA", dialCode: "+1", flag: "🇨🇦" },
    { name: "Cape Verde", code: "CV", dialCode: "+238", flag: "🇨🇻" },
    { name: "Cayman Islands", code: "KY", dialCode: "+1-345", flag: "🇰🇾" },
    { name: "Central African Republic", code: "CF", dialCode: "+236", flag: "🇨🇫" },
    { name: "Chad", code: "TD", dialCode: "+235", flag: "🇹🇩" },
    { name: "Chile", code: "CL", dialCode: "+56", flag: "🇨🇱" },
    { name: "China", code: "CN", dialCode: "+86", flag: "🇨🇳" },
    { name: "Christmas Island", code: "CX", dialCode: "+61", flag: "🇨🇽" },
    { name: "Cocos (Keeling) Islands", code: "CC", dialCode: "+61", flag: "🇨🇨" },
    { name: "Colombia", code: "CO", dialCode: "+57", flag: "🇨🇴" },
    { name: "Comoros", code: "KM", dialCode: "+269", flag: "🇰🇲" },
    { name: "Congo", code: "CG", dialCode: "+242", flag: "🇨🇬" },
    { name: "Cook Islands", code: "CK", dialCode: "+682", flag: "🇨🇰" },
    { name: "Costa Rica", code: "CR", dialCode: "+506", flag: "🇨🇷" },
    { name: "Croatia", code: "HR", dialCode: "+385", flag: "🇭🇷" },
    { name: "Cuba", code: "CU", dialCode: "+53", flag: "🇨🇺" },
    { name: "Curaçao", code: "CW", dialCode: "+599", flag: "🇨🇼" },
    { name: "Cyprus", code: "CY", dialCode: "+357", flag: "🇨🇾" },
    { name: "Czech Republic", code: "CZ", dialCode: "+420", flag: "🇨🇿" },
    { name: "Democratic Republic of the Congo", code: "CD", dialCode: "+243", flag: "🇨🇩" },
    { name: "Denmark", code: "DK", dialCode: "+45", flag: "🇩🇰" },
    { name: "Djibouti", code: "DJ", dialCode: "+253", flag: "🇩🇯" },
    { name: "Dominica", code: "DM", dialCode: "+1-767", flag: "🇩🇲" },
    { name: "Dominican Republic", code: "DO", dialCode: "+1-809, 1-829, 1-849", flag: "🇩🇴" },
    { name: "East Timor", code: "TL", dialCode: "+670", flag: "🇹🇱" },
    { name: "Ecuador", code: "EC", dialCode: "+593", flag: "🇪🇨" },
    { name: "Egypt", code: "EG", dialCode: "+20", flag: "🇪🇬" },
    { name: "El Salvador", code: "SV", dialCode: "+503", flag: "🇸🇻" },
    { name: "Equatorial Guinea", code: "GQ", dialCode: "+240", flag: "🇬🇶" },
    { name: "Eritrea", code: "ER", dialCode: "+291", flag: "🇪🇷" },
    { name: "Estonia", code: "EE", dialCode: "+372", flag: "🇪🇪" },
    { name: "Ethiopia", code: "ET", dialCode: "+251", flag: "🇪🇹" },
    { name: "Falkland Islands", code: "FK", dialCode: "+500", flag: "🇫🇰" },
    { name: "Faroe Islands", code: "FO", dialCode: "+298", flag: "🇫🇴" },
    { name: "Fiji", code: "FJ", dialCode: "+679", flag: "🇫🇯" },
    { name: "Finland", code: "FI", dialCode: "+358", flag: "🇫🇮" },
    { name: "France", code: "FR", dialCode: "+33", flag: "🇫🇷" },
    { name: "French Polynesia", code: "PF", dialCode: "+689", flag: "🇵🇫" },
    { name: "Gabon", code: "GA", dialCode: "+241", flag: "🇬🇦" },
    { name: "Gambia", code: "GM", dialCode: "+220", flag: "🇬🇲" },
    { name: "Georgia", code: "GE", dialCode: "+995", flag: "🇬🇪" },
    { name: "Germany", code: "DE", dialCode: "+49", flag: "🇩🇪" },
    { name: "Ghana", code: "GH", dialCode: "+233", flag: "🇬🇭" },
    { name: "Gibraltar", code: "GI", dialCode: "+350", flag: "🇬🇮" },
    { name: "Greece", code: "GR", dialCode: "+30", flag: "🇬🇷" },
    { name: "Greenland", code: "GL", dialCode: "+299", flag: "🇬🇱" },
    { name: "Grenada", code: "GD", dialCode: "+1-473", flag: "🇬🇩" },
    { name: "Guam", code: "GU", dialCode: "+1-671", flag: "🇬🇺" },
    { name: "Guatemala", code: "GT", dialCode: "+502", flag: "🇬🇹" },
    { name: "Guernsey", code: "GG", dialCode: "+44-1481", flag: "🇬🇬" },
    { name: "Guinea", code: "GN", dialCode: "+224", flag: "🇬🇳" },
    { name: "Guinea-Bissau", code: "GW", dialCode: "+245", flag: "🇬🇼" },
    { name: "Guyana", code: "GY", dialCode: "+592", flag: "🇬🇾" },
    { name: "Haiti", code: "HT", dialCode: "+509", flag: "🇭🇹" },
    { name: "Honduras", code: "HN", dialCode: "+504", flag: "🇭🇳" },
    { name: "Hong Kong", code: "HK", dialCode: "+852", flag: "🇭🇰" },
    { name: "Hungary", code: "HU", dialCode: "+36", flag: "🇭🇺" },
    { name: "Iceland", code: "IS", dialCode: "+354", flag: "🇮🇸" },
    { name: "India", code: "IN", dialCode: "+91", flag: "🇮🇳" },
    { name: "Indonesia", code: "ID", dialCode: "+62", flag: "🇮🇩" },
    { name: "Iran", code: "IR", dialCode: "+98", flag: "🇮🇷" },
    { name: "Iraq", code: "IQ", dialCode: "+964", flag: "🇮🇶" },
    { name: "Ireland", code: "IE", dialCode: "+353", flag: "🇮🇪" },
    { name: "Isle of Man", code: "IM", dialCode: "+44-1624", flag: "🇮🇲" },
    { name: "Israel", code: "IL", dialCode: "+972", flag: "🇮🇱" },
    { name: "Italy", code: "IT", dialCode: "+39", flag: "🇮🇹" },
    { name: "Ivory Coast", code: "CI", dialCode: "+225", flag: "🇨🇮" },
    { name: "Jamaica", code: "JM", dialCode: "+1-876", flag: "🇯🇲" },
    { name: "Japan", code: "JP", dialCode: "+81", flag: "🇯🇵" },
    { name: "Jersey", code: "JE", dialCode: "+44-1534", flag: "🇯🇪" },
    { name: "Jordan", code: "JO", dialCode: "+962", flag: "🇯🇴" },
    { name: "Kazakhstan", code: "KZ", dialCode: "+7", flag: "🇰🇿" },
    { name: "Kenya", code: "KE", dialCode: "+254", flag: "🇰🇪" },
    { name: "Kiribati", code: "KI", dialCode: "+686", flag: "🇰🇮" },
    { name: "Kosovo", code: "XK", dialCode: "+383", flag: "🇽🇰" },
    { name: "Kuwait", code: "KW", dialCode: "+965", flag: "🇰🇼" },
    { name: "Kyrgyzstan", code: "KG", dialCode: "+996", flag: "🇰🇬" },
    { name: "Laos", code: "LA", dialCode: "+856", flag: "🇱🇦" },
    { name: "Latvia", code: "LV", dialCode: "+371", flag: "🇱🇻" },
    { name: "Lebanon", code: "LB", dialCode: "+961", flag: "🇱🇧" },
    { name: "Lesotho", code: "LS", dialCode: "+266", flag: "🇱🇸" },
    { name: "Liberia", code: "LR", dialCode: "+231", flag: "🇱🇷" },
    { name: "Libya", code: "LY", dialCode: "+218", flag: "🇱🇾" },
    { name: "Liechtenstein", code: "LI", dialCode: "+423", flag: "🇱🇮" },
    { name: "Lithuania", code: "LT", dialCode: "+370", flag: "🇱🇹" },
    { name: "Luxembourg", code: "LU", dialCode: "+352", flag: "🇱🇺" },
    { name: "Macau", code: "MO", dialCode: "+853", flag: "🇲🇴" },
    { name: "Macedonia", code: "MK", dialCode: "+389", flag: "🇲🇰" },
    { name: "Madagascar", code: "MG", dialCode: "+261", flag: "🇲🇬" },
    { name: "Malawi", code: "MW", dialCode: "+265", flag: "🇲🇼" },
    { name: "Malaysia", code: "MY", dialCode: "+60", flag: "🇲🇾" },
    { name: "Maldives", code: "MV", dialCode: "+960", flag: "🇲🇻" },
    { name: "Mali", code: "ML", dialCode: "+223", flag: "🇲🇱" },
    { name: "Malta", code: "MT", dialCode: "+356", flag: "🇲🇹" },
    { name: "Marshall Islands", code: "MH", dialCode: "+692", flag: "🇲🇭" },
    { name: "Mauritania", code: "MR", dialCode: "+222", flag: "🇲🇷" },
    { name: "Mauritius", code: "MU", dialCode: "+230", flag: "🇲🇺" },
    { name: "Mayotte", code: "YT", dialCode: "+262", flag: "🇾🇹" },
    { name: "Mexico", code: "MX", dialCode: "+52", flag: "🇲🇽" },
    { name: "Micronesia", code: "FM", dialCode: "+691", flag: "🇫🇲" },
    { name: "Moldova", code: "MD", dialCode: "+373", flag: "🇲🇩" },
    { name: "Monaco", code: "MC", dialCode: "+377", flag: "🇲🇨" },
    { name: "Mongolia", code: "MN", dialCode: "+976", flag: "🇲🇳" },
    { name: "Montenegro", code: "ME", dialCode: "+382", flag: "🇲🇪" },
    { name: "Montserrat", code: "MS", dialCode: "+1-664", flag: "🇲🇸" },
    { name: "Morocco", code: "MA", dialCode: "+212", flag: "🇲🇦" },
    { name: "Mozambique", code: "MZ", dialCode: "+258", flag: "🇲🇿" },
    { name: "Myanmar", code: "MM", dialCode: "+95", flag: "🇲🇲" },
    { name: "Namibia", code: "NA", dialCode: "+264", flag: "🇳🇦" },
    { name: "Nauru", code: "NR", dialCode: "+674", flag: "🇳🇷" },
    { name: "Nepal", code: "NP", dialCode: "+977", flag: "🇳🇵" },
    { name: "Netherlands", code: "NL", dialCode: "+31", flag: "🇳🇱" },
    { name: "New Caledonia", code: "NC", dialCode: "+687", flag: "🇳🇨" },
    { name: "New Zealand", code: "NZ", dialCode: "+64", flag: "🇳🇿" },
    { name: "Nicaragua", code: "NI", dialCode: "+505", flag: "🇳🇮" },
    { name: "Niger", code: "NE", dialCode: "+227", flag: "🇳🇪" },
    { name: "Nigeria", code: "NG", dialCode: "+234", flag: "🇳🇳" },
    { name: "Niue", code: "NU", dialCode: "+683", flag: "🇳🇺" },
    { name: "Norfolk Island", code: "NF", dialCode: "+672", flag: "🇳🇫" },
    { name: "North Korea", code: "KP", dialCode: "+850", flag: "🇰🇵" },
    { name: "Northern Mariana Islands", code: "MP", dialCode: "+1-670", flag: "🇲🇵" },
    { name: "Norway", code: "NO", dialCode: "+47", flag: "🇳🇴" },
    { name: "Oman", code: "OM", dialCode: "+968", flag: "🇴🇲" },
    { name: "Pakistan", code: "PK", dialCode: "+92", flag: "🇵🇰" },
    { name: "Palau", code: "PW", dialCode: "+680", flag: "🇵🇼" },
    { name: "Palestine", code: "PS", dialCode: "+970", flag: "🇵🇸" },
    { name: "Panama", code: "PA", dialCode: "+507", flag: "🇵🇦" },
    { name: "Papua New Guinea", code: "PG", dialCode: "+675", flag: "🇵🇬" },
    { name: "Paraguay", code: "PY", dialCode: "+595", flag: "🇵🇾" },
    { name: "Peru", code: "PE", dialCode: "+51", flag: "🇵🇪" },
    { name: "Philippines", code: "PH", dialCode: "+63", flag: "🇵🇭" },
    { name: "Pitcairn", code: "PN", dialCode: "+64", flag: "🇵🇳" },
    { name: "Poland", code: "PL", dialCode: "+48", flag: "🇵🇱" },
    { name: "Portugal", code: "PT", dialCode: "+351", flag: "🇵🇹" },
    { name: "Puerto Rico", code: "PR", dialCode: "+1-787, 1-939", flag: "🇵🇷" },
    { name: "Qatar", code: "QA", dialCode: "+974", flag: "🇶🇦" },
    { name: "Reunion", code: "RE", dialCode: "+262", flag: "🇷🇪" },
    { name: "Romania", code: "RO", dialCode: "+40", flag: "🇷🇴" },
    { name: "Russia", code: "RU", dialCode: "+7", flag: "🇷🇺" },
    { name: "Rwanda", code: "RW", dialCode: "+250", flag: "🇷🇼" },
    { name: "Saint Barthelemy", code: "BL", dialCode: "+590", flag: "🇧🇱" },
    { name: "Saint Helena", code: "SH", dialCode: "+290", flag: "🇸🇭" },
    { name: "Saint Kitts and Nevis", code: "KN", dialCode: "+1-869", flag: "🇰🇳" },
    { name: "Saint Lucia", code: "LC", dialCode: "+1-758", flag: "🇱🇨" },
    { name: "Saint Martin", code: "MF", dialCode: "+590", flag: "🇲🇫" },
    { name: "Saint Pierre and Miquelon", code: "PM", dialCode: "+508", flag: "🇵🇲" },
    { name: "Saint Vincent and the Grenadines", code: "VC", dialCode: "+1-784", flag: "🇻🇨" },
    { name: "Samoa", code: "WS", dialCode: "+685", flag: "🇼🇸" },
    { name: "San Marino", code: "SM", dialCode: "+378", flag: "🇸🇲" },
    { name: "Sao Tome and Principe", code: "ST", dialCode: "+239", flag: "🇸🇹" },
    { name: "Saudi Arabia", code: "SA", dialCode: "+966", flag: "🇸🇦" },
    { name: "Senegal", code: "SN", dialCode: "+221", flag: "🇸🇳" },
    { name: "Serbia", code: "RS", dialCode: "+381", flag: "🇷🇸" },
    { name: "Seychelles", code: "SC", dialCode: "+248", flag: "🇸🇨" },
    { name: "Sierra Leone", code: "SL", dialCode: "+232", flag: "🇸🇱" },
    { name: "Singapore", code: "SG", dialCode: "+65", flag: "🇸🇬" },
    { name: "Sint Maarten", code: "SX", dialCode: "+1-721", flag: "🇸🇽" },
    { name: "Slovakia", code: "SK", dialCode: "+421", flag: "🇸🇰" },
    { name: "Slovenia", code: "SI", dialCode: "+386", flag: "🇸🇮" },
    { name: "Solomon Islands", code: "SB", dialCode: "+677", flag: "🇸🇧" },
    { name: "Somalia", code: "SO", dialCode: "+252", flag: "🇸🇴" },
    { name: "South Africa", code: "ZA", dialCode: "+27", flag: "🇿🇦" },
    { name: "South Korea", code: "KR", dialCode: "+82", flag: "🇰🇷" },
    { name: "South Sudan", code: "SS", dialCode: "+211", flag: "🇸🇸" },
    { name: "Spain", code: "ES", dialCode: "+34", flag: "🇪🇸" },
    { name: "Sri Lanka", code: "LK", dialCode: "+94", flag: "🇱🇰" },
    { name: "Sudan", code: "SD", dialCode: "+249", flag: "🇸🇩" },
    { name: "Suriname", code: "SR", dialCode: "+597", flag: "🇸🇷" },
    { name: "Svalbard and Jan Mayen", code: "SJ", dialCode: "+47", flag: "🇸🇯" },
    { name: "Swaziland", code: "SZ", dialCode: "+268", flag: "🇸🇿" },
    { name: "Sweden", code: "SE", dialCode: "+46", flag: "🇸🇪" },
    { name: "Switzerland", code: "CH", dialCode: "+41", flag: "🇨🇭" },
    { name: "Syria", code: "SY", dialCode: "+963", flag: "🇸🇾" },
    { name: "Taiwan", code: "TW", dialCode: "+886", flag: "🇹🇼" },
    { name: "Tajikistan", code: "TJ", dialCode: "+992", flag: "🇹🇯" },
    { name: "Tanzania", code: "TZ", dialCode: "+255", flag: "🇹🇿" },
    { name: "Thailand", code: "TH", dialCode: "+66", flag: "🇹🇭" },
    { name: "Togo", code: "TG", dialCode: "+228", flag: "🇹🇬" },
    { name: "Tokelau", code: "TK", dialCode: "+690", flag: "🇹🇰" },
    { name: "Tonga", code: "TO", dialCode: "+676", flag: "🇹🇴" },
    { name: "Trinidad and Tobago", code: "TT", dialCode: "+1-868", flag: "🇹🇹" },
    { name: "Tunisia", code: "TN", dialCode: "+216", flag: "🇹🇳" },
    { name: "Turkey", code: "TR", dialCode: "+90", flag: "🇹🇷" },
    { name: "Turkmenistan", code: "TM", dialCode: "+993", flag: "🇹🇲" },
    { name: "Turks and Caicos Islands", code: "TC", dialCode: "+1-649", flag: "🇹🇨" },
    { name: "Tuvalu", code: "TV", dialCode: "+688", flag: "🇹🇻" },
    { name: "Uganda", code: "UG", dialCode: "+256", flag: "🇺🇬" },
    { name: "Ukraine", code: "UA", dialCode: "+380", flag: "🇺🇦" },
    { name: "United Arab Emirates", code: "AE", dialCode: "+971", flag: "🇦🇪" },
    { name: "United Kingdom", code: "GB", dialCode: "+44", flag: "🇬🇧" },
    { name: "United States", code: "US", dialCode: "+1", flag: "🇺🇸" },
    { name: "Uruguay", code: "UY", dialCode: "+598", flag: "🇺🇾" },
    { name: "Uzbekistan", code: "UZ", dialCode: "+998", flag: "🇺🇿" },
    { name: "Vanuatu", code: "VU", dialCode: "+678", flag: "🇻🇺" },
    { name: "Vatican", code: "VA", dialCode: "+379", flag: "🇻🇦" },
    { name: "Venezuela", code: "VE", dialCode: "+58", flag: "🇻🇪" },
    { name: "Vietnam", code: "VN", dialCode: "+84", flag: "🇻🇳" },
    { name: "Wallis and Futuna", code: "WF", dialCode: "+681", flag: "🇼🇫" },
    { name: "Western Sahara", code: "EH", dialCode: "+212", flag: "🇪🇭" },
    { name: "Yemen", code: "YE", dialCode: "+967", flag: "🇾🇪" },
    { name: "Zambia", code: "ZM", dialCode: "+260", flag: "🇿🇲" },
    { name: "Zimbabwe", code: "ZW", dialCode: "+263", flag: "🇿🇼" }
];

export interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
    value?: string;
    onChange?: (value: string) => void;
}

export function PhoneInput({ className, value = "", onChange, ...props }: PhoneInputProps) {
    const [selectedCountry, setSelectedCountry] = React.useState<Country>(COUNTRIES[0]);
    const [phoneNumber, setPhoneNumber] = React.useState("");
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Initialize from value prop
    React.useEffect(() => {
        if (!value) {
            setPhoneNumber("");
            return;
        }

        const matchedCountry = COUNTRIES.find(c => value.startsWith(c.dialCode));
        if (matchedCountry) {
            setSelectedCountry(matchedCountry);
            setPhoneNumber(value.replace(matchedCountry.dialCode, "").trim());
        } else {
            setPhoneNumber(value);
        }
    }, [value]);

    // Handle clicks outside to close dropdown
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleCountrySelect = (country: Country) => {
        setSelectedCountry(country);
        setIsOpen(false);
        setSearchQuery(""); // Reset search on selection

        if (onChange) {
            const cleanNumber = phoneNumber.replace(/\D/g, "");
            onChange(`${country.dialCode}${cleanNumber}`);
        }
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        if (!/^[\d\s-]*$/.test(newValue)) return;

        setPhoneNumber(newValue);
        if (onChange) {
            const cleanNumber = newValue.replace(/\D/g, "");
            if (!cleanNumber) {
                onChange("");
            } else {
                onChange(`${selectedCountry.dialCode}${cleanNumber}`);
            }
        }
    };

    const fullValue = `${selectedCountry.dialCode}${phoneNumber.replace(/\D/g, "")}`;

    // Filter countries based on search
    const filteredCountries = COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.dialCode.includes(searchQuery) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className={cn("relative group w-full", className)} ref={dropdownRef}>
            {/* Hidden Input for Form Submission */}
            {props.name && <input type="hidden" name={props.name} value={fullValue} />}

            <div className="flex rounded-xl shadow-sm border border-gray-200 bg-white transition-all focus-within:ring-2 focus-within:ring-[#5e48b8]/20 focus-within:border-[#5e48b8] hover:border-gray-300">
                {/* Custom Country Trigger */}
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 pl-3 pr-2 py-2.5 bg-gray-50/50 border-r border-gray-100 rounded-l-xl hover:bg-gray-100 transition-colors shrink-0 outline-none"
                >
                    <img
                        src={`https://flagcdn.com/w40/${selectedCountry.code.toLowerCase()}.png`}
                        srcSet={`https://flagcdn.com/w80/${selectedCountry.code.toLowerCase()}.png 2x`}
                        alt={selectedCountry.name}
                        className="w-6 h-auto rounded-sm shadow-sm object-cover"
                    />
                    <span className="text-xs font-semibold text-gray-600 tabular-nums tracking-wide">{selectedCountry.dialCode}</span>
                    <PiCaretDown className={cn("text-xs text-gray-400 transition-transform duration-200", isOpen && "rotate-180")} />
                </button>

                {/* Phone Input */}
                <input
                    type="tel"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm font-semibold text-gray-900 placeholder:text-gray-400 outline-none rounded-r-xl"
                    placeholder="712 345 678"
                    {...props}
                    name={undefined}
                />
            </div>

            {/* Custom Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute z-50 top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden"
                    >
                        {/* Search Bar */}
                        <div className="p-3 border-b border-gray-50 bg-gray-50/30 sticky top-0 backdrop-blur-sm">
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search country..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg pl-3 pr-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-[#5e48b8] transition-all placeholder:text-gray-400"
                            />
                        </div>

                        {/* Country List */}
                        <div className="max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                            {filteredCountries.length > 0 ? (
                                <ul className="py-1">
                                    {filteredCountries.map((country) => (
                                        <li key={country.code}>
                                            <button
                                                type="button"
                                                onClick={() => handleCountrySelect(country)}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-gray-50",
                                                    selectedCountry.code === country.code ? "bg-indigo-50/50" : ""
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`}
                                                        srcSet={`https://flagcdn.com/w80/${country.code.toLowerCase()}.png 2x`}
                                                        alt={country.name}
                                                        className="w-6 h-auto rounded-sm shadow-sm object-cover"
                                                    />
                                                    <div className="flex flex-col">
                                                        <span className={cn(
                                                            "text-xs font-semibold",
                                                            selectedCountry.code === country.code ? "text-[#5e48b8]" : "text-gray-700"
                                                        )}>
                                                            {country.name}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-medium">{country.code}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-medium text-gray-500 tabular-nums bg-gray-100 px-1.5 py-0.5 rounded text-right min-w-[36px]">
                                                        {country.dialCode}
                                                    </span>
                                                    {selectedCountry.code === country.code && (
                                                        <PiCheck className="text-[#5e48b8] text-sm" />
                                                    )}
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="px-4 py-8 text-center">
                                    <p className="text-xs text-gray-500 font-medium">No countries found</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
