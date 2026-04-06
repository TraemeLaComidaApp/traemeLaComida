import React from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSelector.css';

const LanguageSelector = () => {
    const { i18n } = useTranslation();

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

    return (
        <div className="language-selector">
            <select 
                value={i18n.language.split('-')[0]} 
                onChange={(e) => changeLanguage(e.target.value)} 
                className="lang-select"
            >
                <option value="es">🇪🇸 ES</option>
                <option value="en">🇬🇧 EN</option>
                <option value="fr">🇫🇷 FR</option>
                <option value="de">🇩🇪 DE</option>
            </select>
        </div>
    );
};

export default LanguageSelector;
