// ==UserScript==
// @name        Jitai
// @description Displays your WaniKani reviews with randomized fonts
// @version     3.1.0
// @author      @obskyr, edited by @marciska and @jrom99
// @namespace   jrom99
// @icon        https://raw.github.com/jrom99/Jitai/main/imgs/jitai.ico
// @homepage    https://github.com/jrom99/Jitai

// @match       https://*.wanikani.com/subjects/review*
// @match       https://*.wanikani.com/subjects/extra_study*
// @run-at      document-start
// @grant       GM_addStyle
// @grant       GM_getResourceText
// @resource    fonts https://raw.github.com/jrom99/Jitai/main/fonts/fonts.json5
// @require     https://unpkg.com/json5@2/dist/index.min.js

// @license     MIT; http://opensource.org/licenses/MIT
// @supportURL  https://github.com/jrom99/Jitai/issues
// @updateURL   https://raw.github.com/jrom99/Jitai/main/Jitai.user.js
// @downloadURL https://raw.github.com/jrom99/Jitai/main/Jitai.user.js
// ==/UserScript==

// TODO: check webfonts with github
// TODO: use @font-face rules in .css with Wanikani's unicode-range
// TODO: host Google webfonts on GitHub (check licenses)
// TODO: Use multi-filter for category + source
// TODO: add homepage for all fonts
// TODO: add setting to pair reading/meaning fonts
// TODO: only load local fonts by default (GDPR)


(async (global) => {
    'use strict';

    /* global wkof */

    const scriptId = "jitai";
    const scriptName = "Jitai";
    const exampleSentence = '吾輩は猫である。名前はまだ無い';

    /** @typedef { "mincho" | "gothic" | "maru-gothic" | "brush" | "stylized" | "ud" | "antique" } FontCategory */

    class Font {
        /**
         * @param {Object} obj The font object
         * @param {string | string[]} obj.familyName
         * @param {string} [obj.displayName]
         * @param {boolean} [obj.recommended=false]
         * @param {FontCategory[]} [obj.categories]
         * @param {string | null} [obj.url]
         * @param {string | null} [obj.homepage]
         */
        constructor({ familyName, displayName, recommended = false, categories = [], url = null, homepage = null }) {
            /** @param {string} val @returns {string} */
            function unquote(val) {
                return val.replace(/^['"\s]+/, '').replace(/['"\s]+$/, '');
            }

            this.familyNames = (Array.isArray(familyName) ? familyName : [familyName]).map((f) => unquote(f));

            // get single quoted family name version (for HTML insertion)
            this.familyName = this.familyNames.map((f) => `'${f}'`).join(", ");
            this.displayName = displayName ?? this.familyNames[0];
            this.recommended = recommended;
            this.categories = Array.isArray(categories) ? categories : [categories];
            this.url = url;
            this.homepage = homepage;
            this.id = this.uniqueValidHtmlId(this.displayName);
        }

        /**
         * Detect whether font is installed, will return false for the default monospace one
         * @returns {boolean}
         */
        isInstalled() {
            // Approach from kirupa.com/html5/detect_whether_font_is_installed.htm - thanks!
            // Will return false for the browser's default monospace font, sadly.
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            if (context === null) {
                throw new Error("Unable to get canvas context")
            }

            const text = "wim-—l~ツ亻".repeat(100); // Characters with widths that often vary between fonts.

            context.font = "72px monospace";
            const defaultWidth = context.measureText(text).width;

            // Microsoft Edge raises an error when a context's font is set to a string
            // containing certain special characters... so that needs to be handled.
            try {
                context.font = `72px ${this.familyName}, monospace`;
            } catch (e) {
                return false;
            }
            const testWidth = context.measureText(text).width;

            return testWidth != defaultWidth;
        }

        /** Adds a webfont's link */
        install() {
            // If webfont already installed on local machine, don't need to reinstall
            if (this.url === null || this.isInstalled()) { return; }

            // install webfont
            const link = document.querySelector(`link[href="${this.url}"]`);
            if (link !== null) {
                const newlink = document.createElement("link");
                newlink.href = this.url;
                newlink.rel = "stylesheet";
                document.head.append(newlink);
            }
        }

        /** Removes a webfont's link */
        uninstall() {
            if (this.url === null) { return; }

            const link = document.querySelector(`link[href="${this.url}"]`);
            if (link !== null) {
                link.remove();
            }
        }

        /**
         * (Internal) check if the canvas is empty
         * @param {HTMLCanvasElement} canvas 
         * @returns {boolean}
         */
        static isCanvasBlank(canvas) {
            const context = canvas.getContext('2d');
            if (context === null) {
                throw new Error("Unable to get canvas context");
            }
            return !context
                .getImageData(0, 0, canvas.width, canvas.height).data
                .some(channel => channel !== 0);
        };

        /** Adds preconnect links to Google Fonts servers */
        static addPreconnectLinks() {
            let /** @type {HTMLLinkElement | null} */ googleApiLink = document.querySelector(`link[href="https://fonts.googleapis.com"]`);
            if (googleApiLink === null) {
                googleApiLink = document.createElement("link");
                googleApiLink.rel = "preconnect";
                googleApiLink.href = "https://fonts.googleapis.com";
                document.head.append(googleApiLink);
            }

            let /** @type {HTMLLinkElement | null} */ gstaticLink = document.querySelector(`link[href="https://fonts.gstatic.com"]`);
            if (gstaticLink === null) {
                gstaticLink = document.createElement("link");
                gstaticLink.rel = "preconnect";
                gstaticLink.href = "https://fonts.gstatic.com";
                gstaticLink.crossOrigin = "anonymous";
                document.head.append(gstaticLink);
            }
        }

        /** Detects whether a given string can be rendered
         * @param {string} glyphs 
         * @returns {boolean}
         */
        canRepresentGlyphs(glyphs) {
            const canvas = document.createElement('canvas');
            canvas.width = 50;
            canvas.height = 50;
            const context = canvas.getContext("2d");
            if (context === null) {
                throw new Error("Unable to get canvas context");
            }

            context.textBaseline = 'top';

            context.font = `24px ${this.familyName}`;

            let result = true;
            for (let i = 0; i < glyphs.length; i++) {
                context.fillText(glyphs[i], 0, 0);
                if (Font.isCanvasBlank(canvas)) {
                    result = false;
                    break;
                }
                context.clearRect(0, 0, canvas.width, canvas.height);
            }

            return result;
        }

        /** Returns a given HTML element's font family
         * @param {Element} el
         * @returns {Font}
         */
        static getElementFont(el) {
            const fontFamily = getComputedStyle(el).fontFamily.replaceAll('"', "").split(",");
            return new Font({ familyName: fontFamily, displayName: "Default" });
        }

        /** Creates a valid HTML ID from a string
         * @param {string} val
         * @returns {string}
         */
        static validHtmlId(val) {
            return val.replace(/[^\w\d]+/g, "_").replace(/_+/g, "_")
        }

        /** Returns a unique value if input is different
         * @template P
         * @template R
         * @param {(param: P) => R} fun 
         * @returns {(param: P) => R | string}
         */
        static uniqueReturnValue(fun) {
            /** @const {Map<R, string>} */
            const memory = new Map();

            return function (param) {
                let retval = fun(param);

                let k = memory.get(retval);
                if (k === undefined) {
                    memory.set(retval, [param]);
                    return retval;
                }
                let i = k.indexOf(param);
                if (i === -1) {
                    k.push(param);
                    i = k.length - 1;
                }
                if (i === 0) {
                    return retval
                }

                return `${retval}${i}`
            }
        }

        uniqueValidHtmlId = Font.uniqueReturnValue(Font.validHtmlId)
    }

    if (!wkof) {
        if (confirm(`${scriptName} requires Wanikani Open Framework.\nDo you want to be forwarded to the installation instructions?`)) {
            global.location.href = 'https://community.wanikani.com/t/instructions-installing-wanikani-open-framework/28549';
        }
        return;
    }

    wkof.include("Settings,Menu");

    const itemElementClass = "character-header__characters";

    const loadData = Promise.all([getItem(), getFontData()]);
    const [{ itemElement, defaultFont }, { allFonts, metadata }] = await loadData;

    let /** @type {Font} */ randomizedFont;
    let /** @type {Font[]} */ selectedFonts = [...allFonts];

    Promise.all([
        loadData.then(setupEvents),
        wkof.ready("Settings,Menu").then(loadSettings)
    ]).then(onSettingsUpdate).then(installSettingsMenu);

    async function loadSettings() {
        // use all fonts by default
        const defaults = {
            fonts: Object.fromEntries(allFonts.map((f) => [f.id, { useFont: true }])),
        }
        console.debug("Defaults:", defaults);
        return wkof.Settings.load(scriptId, defaults);
    }

    /** Adds settings menu to interface */
    async function installSettingsMenu() {
        return wkof.Menu.insert_script_link({
            name: scriptId,
            submenu: 'Settings',
            title: scriptName,
            on_click: openSettings
        });
    }

    async function onSettingsSave() {
        await wkof.Settings.save(scriptId);
        onSettingsUpdate()
    }

    /** Defines selected fonts, shuffles them and changes the font if necessary */
    async function onSettingsUpdate() {
        // clear cache of selected fonts
        const settings = wkof.settings[scriptId]
        console.debug("Applying settings:", settings);
        const old = [...selectedFonts];
        selectedFonts = [];

        // now refill the pool of selected fonts
        for (const font of allFonts) {
            // install enabled fonts
            const useFont = settings.fonts[font.id].useFont;

            if (useFont) {
                font.install();
                if (!font.isInstalled()) {
                    console.warn("Failed to install font:", font)
                } else {
                    selectedFonts.push(font);
                }
            }
            // } else {
            //     font.uninstall()
            // }
        }
        console.log(selectedFonts.length === 0 ? "No fonts selected" : `${selectedFonts.length} fonts selected`)
        console.debug(
            `${scriptName}: old x new:`,
            "removed", old.filter((i) => !selectedFonts.includes(i)),
            "added:", selectedFonts.filter((i) => !old.includes(i))
        )
        // randomly shuffle font pool
        shuffleArray(selectedFonts);

        if (!selectedFonts.includes(randomizedFont)) {
            // update font if new font is not selected
            updateRandomFont(true, false);
        }
    }

    function openSettings() {
        const homepageSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32h82.7L201.4 265.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L448 109.3V192c0 17.7 14.3 32 32 32s32-14.3 32-32V32c0-17.7-14.3-32-32-32H320zM80 32C35.8 32 0 67.8 0 112V432c0 44.2 35.8 80 80 80H400c44.2 0 80-35.8 80-80V320c0-17.7-14.3-32-32-32s-32 14.3-32 32V432c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V112c0-8.8 7.2-16 16-16H192c17.7 0 32-14.3 32-32s-14.3-32-32-32H80z"/></svg>'
        const /** @type {{ [k: string]: GroupComponent }} */ fontListHtml = {};
        for (const font of allFonts) {
            fontListHtml[`BOX_${font.id}`] = {
                type: 'group',
                label: `<span class="font_label${font.recommended ? ' font_recommended' : ''}">${font.homepage !== null ? `<a class="font_homepage" href="${font.homepage}">${homepageSvg}</a>` : ''}${font.displayName}</span>`,
                content: {
                    sampletext: {
                        type: 'html',
                        html: `<p class="font_example" style="font-family: ${font.familyName}, ${defaultFont.familyName};">${exampleSentence}</p>`
                    },
                    [`${font.id}_useFont`]: {
                        type: 'checkbox',
                        label: `Use font in ${scriptName}`,
                        path: `@fonts[${font.id}].useFont`,
                        default: false,
                    },
                }
            }
        }

        let dialog = new wkof.Settings({
            script_id: scriptId,
            title: `${scriptName} Settings`,
            on_save: onSettingsSave,
            content: {
                currentFont: {
                    type: 'group',
                    label: `<span class="font_label">Current Font: ${randomizedFont.displayName}</span>`,
                    content: {
                        sampleText: {
                            type: 'html',
                            html: `<p class="font_example" style="font-family: ${randomizedFont.familyName}">${exampleSentence}</p>`
                        }
                    }
                },
                legend: {
                    type: 'html',
                    html: `<div class="font_legend"><span class="font_recommended">: Recommended Font</span></div>`
                },
                divider: {
                    type: 'section',
                    label: `Select Fonts (${allFonts.length} available)`
                },
                ...fontListHtml
            }
        });
        dialog.open();
    }

    /** Randomly shuffles an array in place
     * @param {Array<any>} array
     */
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    /** Change the font of the review item (show default on hover)
     * @param {boolean} update - whether to change the font 
     * @param {boolean} hoverFlipped - whether to invert hover behavior
     * @param {string} [glyphs] - review item text content
     */
    function updateRandomFont(update, hoverFlipped, glyphs) {
        // choose new random font
        if (update) {
            const text = glyphs === undefined ? itemElement.innerText : glyphs;
            const canUse = selectedFonts.filter((f) => f.canRepresentGlyphs(text));

            if (selectedFonts.length == 0) {
                console.warn(`${scriptName}: empty font pool!`)
                randomizedFont = defaultFont;
            } else if (canUse.length === 0) {
                console.warn(`${scriptName}: no selected font can draw this text.`);
                randomizedFont = defaultFont;
            } else {
                console.debug(`${scriptName}: Usable fonts (${canUse.length}/${selectedFonts.length}) for "${text}":`, canUse);
                randomizedFont = canUse[Math.floor(Math.random() * canUse.length)];
                console.info(`${scriptName}: New random font: "${randomizedFont.displayName}"`, randomizedFont)
            }
        }

        // show font
        if (hoverFlipped) {
            itemElement.style.setProperty("--font-family-japanese", defaultFont.familyName);
            itemElement.style.setProperty("--font-family-japanese-hover", randomizedFont.familyName);
        } else {
            itemElement.style.setProperty("--font-family-japanese", randomizedFont.familyName);
            itemElement.style.setProperty("--font-family-japanese-hover", defaultFont.familyName);
        }

        // Restore item visibility
        itemElement.style.opacity = "1";
    }

    /** Wait until an element is added to the DOM
     * @param {string} selector
     * @returns {Promise<HTMLElement>}
    */
    function waitForElement(selector) {
        return new Promise(resolve => {
            const elt = document.getElementsByClassName(selector)[0];
            if (elt) {
                return resolve(/** @type {HTMLElement} */(elt));
            }

            const observer = new MutationObserver(mutations => {
                const elt2 = document.getElementsByClassName(selector)[0];
                if (elt2) {
                    observer.disconnect();
                    resolve(/** @type {HTMLElement} */(elt2));
                }
            });

            // If you get "parameter 1 is not of type 'Node'" error, see https://stackoverflow.com/a/77855838/492336
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        });
    }

    /** Loads JSON5 with font data
     * @returns {Promise<{allFonts: Font[], metadata: { categories: Map<string | null, Font[]>}}>}
    */
    async function getFontData() {
        // @ts-ignore
        const /** @type {any[]} */ fontData = JSON5.parse(GM_getResourceText("fonts"));
        const pool = fontData.map((f) => new Font(f));

        // remove non-accesible local fonts for selection
        // and order fonts alphabetically
        const availableFonts = pool
            .filter((f) => f.url !== null || f.isInstalled())
            .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));

        const /** @type {Map<string | null, Font[]>} */ categories = new Map();
        categories.set(null, []);

        for (const font of pool) {
            if (font.categories.length === 0) {
                categories.get(null)?.push(font);
            } else {
                for (const cat of font.categories) {
                    if (!categories.has(cat)) {
                        categories.set(cat, [])
                    }
                    categories.get(cat)?.push(font);
                }
            }
        }

        console.debug(`${scriptName}: ${availableFonts.length} of ${pool.length} fonts available`)
        console.debug(`${scriptName}: Available categories are`, [...categories.keys()]);
        return { allFonts: availableFonts, metadata: { categories: categories } };
    }

    async function getItem() {
        const el = await waitForElement(itemElementClass);
        return { itemElement: el, defaultFont: Font.getElementFont(el) };
    }

    /** Inserts CSS and sets event listeners */
    async function setupEvents() {
        // insert CSS
        GM_addStyle(`
            .font_label {
                font-size: 1.2em;
                display: flex;
                align-items: center;
            }
            .font_legend {
                text-align: center;
                margin: 15px !important;
            }
            .font_example {
                margin: 5px 10px 10px 10px !important;
                font-size: 1.6em;
                line-height: 1.1em;
            }
            .font_example:hover {
                font-family: ${defaultFont.familyName} !important;
            }
            .font_recommended::before {
                content: '⭐️';
                font-size: 1.1em;
            }
            .font_homepage {
                width: .8em;
                margin: .1em; !important;
            }

            /* on mouse hovering, show default font */
            .${itemElementClass} {
                font-family: var(--font-family-japanese);
            }
            .${itemElementClass}:hover {
                font-family: var(--font-family-japanese-hover);
            }
        `);

        itemElement.style.opacity = "0";
        itemElement.style.setProperty("--font-family-japanese-hover", defaultFont.familyName);

        // on answer submission, invert hovering event
        //  - normal  : default font
        //  - hovering: randomized font
        global.addEventListener("didAnswerQuestion", () => { console.debug("didAnswer"); updateRandomFont(false, true) });

        // on advancing to next item question, randomize font again
        global.addEventListener("willShowNextQuestion", (e) => { console.debug("willShow"); updateRandomFont(true, false, e.detail.subject.characters) });

        // on reverting an answer by DoubleCheckScript, reroll random font and fix inverting of hovering
        global.addEventListener("didUnanswerQuestion", () => { console.debug("didUnanswer"); updateRandomFont(true, false) });

        // add event to reroll randomized font
        global.addEventListener("keydown", (e) => {
            if (e.key === ';') { console.log("keydown"); updateRandomFont(true, false); }
        });
    }
})(window);
