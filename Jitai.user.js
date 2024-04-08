// ==UserScript==
// @name        Jitai
// @description Displays your WaniKani reviews with randomized fonts
// @version     3.0.1
// @author      @obskyr, edited by @marciska and @jrom99
// @namespace   jrom99
// @icon        https://raw.github.com/jrom99/Jitai/main/imgs/jitai.ico
// @homepage    https://github.com/jrom99/Jitai

// @match       https://*.wanikani.com/subjects/review*
// @match       https://*.wanikani.com/subjects/extra_study*
// @run-at      document-body
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
// TODO: host Google webfonts on GitHub (if legal)
// TODO: what about three state checkbutton/toggle for category and origin?
// TODO: add font homepage icon
// TODO: add homepage for all fonts
// TODO: add setting to pair reading/meaning fonts

((global) => {
    'use strict';

    /* global wkof */

    const scriptId = "jitai";
    const scriptName = "Jitai";
    const exampleSentence = '吾輩は猫である。名前はまだ無い';
    const itemElementClass = "character-header__characters";

    let /** @type {HTMLElement} */ itemElement;
    let /** @type {string} */ defaultFont;
    let /** @type {string} */ randomizedFont;
    let /** @type {Font[]} */ fontPool;

    const /** @type {Font[]} */ fontPoolSelected = [];
    const /** @type {Map<string | null, Font[]>} */ fontsPerCategory = new Map();
    fontsPerCategory.set(null, []);

    /** @typedef {"mincho" | "gothic" | "maru-gothic" | "brush" | "stylized" | "ud" | "antique" } FontCategory */

    class Font {
        /**
         * @param {Object} obj The font object
         * @param {string} obj.selectorName
         * @param {string} [obj.displayName]
         * @param {boolean} [obj.recommended=false]
         * @param {FontCategory[]} [obj.categories]
         * @param {string | null} [obj.url]
         * @param {string | null} [obj.homepage]
         */
        constructor({ selectorName, displayName, recommended = false, categories = [], url = null, homepage = null }) {
            this.selectorName = selectorName;
            this.displayName = displayName ?? selectorName;
            this.recommended = recommended;
            this.categories = Array.isArray(categories)? categories : [categories];
            this.url = url;
            this.homepage = homepage;
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
                context.font = `72px ${this.selectorName}, monospace`;
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

            context.font = `24px ${this.selectorName}`;

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
    }

    if (!wkof) {
        if (confirm(`${scriptName} requires Wanikani Open Framework.\nDo you want to be forwarded to the installation instructions?`)) {
            global.location.href = 'https://community.wanikani.com/t/instructions-installing-wanikani-open-framework/28549';
        }
        return;
    }

    setup();
    wkof.include("Settings,Menu");
    Font.addPreconnectLinks();
    wkof.ready("Settings,Menu").then(loadSettings).then(installSettingsMenu);

    console.log(`${scriptName} loaded!`)

    async function loadSettings() {
        let defaults = {
            fonts: Object.fromEntries(fontPool.map((f) => [f.displayName, { useFont: f.isInstalled(), frequency: 1 }])),
        }
        return wkof.Settings.load(scriptId, defaults).then(applySettings);
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

    /** Defines selected fonts, shuffles them and change the font
     * @param {typeof wkof.settings.jitai} settings - WKOF.settings.$scriptId object
     */
    function applySettings(settings) {
        // clear cache of selected fonts
        fontPoolSelected.length = 0;

        // now refill the pool of selected fonts
        let selected = 0;
        for (const font of fontPool) {
            // install enabled fonts
            const frequency = Math.ceil(settings.fonts[font.displayName].frequency ?? 1);
            const useFont = settings.fonts[font.displayName].useFont;

            if (frequency > 0 && useFont) {
                selected += 1
                font.install();
            } else {
                font.uninstall()
                continue;
            }

            for (const _ of Array(frequency)) { fontPoolSelected.push(font); }
        }

        console.log(selected === 0 ? "No fonts selected" : `${selected} fonts selected`)

        // randomly shuffle font pool
        shuffleArray(fontPoolSelected);

        updateRandomFont(true, false);

        // Restore item visibility
        itemElement.style.opacity = "1";
    }

    function openSettings() {
        // remove non-accesible local fonts for selection
        // and order fonts alphabetically
        const availableFonts = fontPool
            .filter((f) => f.url !== null || f.isInstalled())
            .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));

        /** prepare Settings page with Font selection component for each category
         * @param {string[]} [categories]
         * @returns {{ [k: string]: GroupComponent }}
        */
        function buildPage(categories) {
            const /** @type {Font[]} */ usableFonts = [];
            if (categories === undefined) {
                usableFonts.push(...(fontsPerCategory.get(null) || []));
            } else {
                for (const cat of categories) {
                    usableFonts.push(...(fontsPerCategory.get(cat) || []));
                }
            }

            const /** @type {{ [k: string]: GroupComponent }} */ pageSettings = {};
            for (const font of usableFonts) {
                pageSettings[`BOX_${font.displayName}`] = {
                    type: 'group',
                    label: `<span class="font_label${font.recommended ? ' font_recommended' : ''}">${font.homepage !== null ? `<a href="${font.homepage}">[homepage] </a>` : ''}${font.displayName}</span>`,
                    content: {
                        sampletext: {
                            type: 'html',
                            html: `<p class="font_example" style="font-family: ${font.selectorName}, ${defaultFont};">${exampleSentence}</p>`
                        },
                        [`${uniqueValidHtmlId(font.displayName)}_useFont`]: {
                            type: 'checkbox',
                            label: `Use font in ${scriptName}`,
                            path: `@fonts[${font.displayName}].useFont`
                        },
                        [`${uniqueValidHtmlId(font.displayName)}_frequency`]: {
                            type: 'number',
                            label: 'Frequency',
                            hover_tip: 'The higher the value, the more often you see this font during review. It is affected by how many fonts you have enabled.',
                            min: 1,
                            default: 1,
                            path: `@fonts[${font.displayName}].frequency`
                        }
                    }
                }
            }

            return pageSettings
        }

        const /** @type {string[]} */ unknownCats = [];
        for (const [cat] of fontsPerCategory) {
            if (cat !== null && !["mincho", "gothic", "maru-gothic", "ud", "brush", "antique", "stylized"].includes(cat)) {
                unknownCats.push(cat)
            }
        }

        let dialog = new wkof.Settings({
            script_id: scriptId,
            title: `${scriptName} Settings`,
            on_close: applySettings,
            content: {
                currentFont: {
                    type: 'group',
                    label: `<span class="font_label">Current Font: ${randomizedFont}</span>`,
                    content: {
                        sampleText: {
                            type: 'html',
                            html: `<p class="font_example" style="font-family:'${randomizedFont}'">${exampleSentence}</p>`
                        }
                    }
                },
                legend: {
                    type: 'html',
                    html: `<div class="font_legend"><span class="font_recommended">: Recommended Font</span></div>`
                },
                divider: {
                    type: 'section',
                    label: `Filter Fonts (${availableFonts.length}/${fontPool.length} available)`
                },
                tabs: {
                    type: 'tabset',
                    content: {
                        page1: {
                            type: 'page',
                            label: 'Regular fonts',
                            content: buildPage(["mincho", "gothic", "maru-gothic", "ud", "antique"])
                        },
                        page2: {
                            type: 'page',
                            label: 'Calligraphy/Handwritten fonts',
                            content: buildPage(["brush"])
                        },
                        page3: {
                            type: 'page',
                            label: 'Decorative fonts',
                            content: buildPage(["stylized"])
                        },
                        ...(unknownCats.length !== 0 ? {
                            page4: {
                                type: 'page',
                                label: 'Other fonts',
                                content: buildPage(unknownCats)
                            }
                        } : {}),
                        page5: {
                            type: 'page',
                            label: 'Uncategorised fonts',
                            content: buildPage()
                        }
                    }
                }
            }
        });
        dialog.open();
    }

    /** Creates a valid HTML ID from a string
     * @param {string} val
     * @returns {string}
     */
    function validHtmlId(val) {
        return val.replace(/[^\w\d]+/g, "_").replace(/_+/g, "_")
    }

    /** Returns a unique value if input is different
     * @template P
     * @template R
     * @param {(param: P) => R} fun 
     * @returns {(param: P) => R | string}
     */
    function uniqueReturnValue(fun) {
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

    const uniqueValidHtmlId = uniqueReturnValue(validHtmlId)

    /** Returns the default fonts applied to the review item
     * @returns {string}
     */
    function getDefaultFont() {
        return getComputedStyle(itemElement).fontFamily.replaceAll('"', "'");
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
     * @param {boolean} hoverFlipped - whether invert hover behavior
     * @param {string} [glyphs] - review item text content
     */
    function updateRandomFont(update, hoverFlipped, glyphs) {
        // choose new random font
        if (update) {
            const text = glyphs === undefined ? itemElement.innerText : glyphs;
            const canUse = fontPoolSelected.filter((f) => f.canRepresentGlyphs(text));

            if (fontPoolSelected.length == 0) {
                console.log(`${scriptName}: empty font pool!`)
                randomizedFont = defaultFont;
            } else if (canUse.length === 0) {
                console.log(`${scriptName}: no selected font can draw this text`);
                randomizedFont = defaultFont;
            } else {
                randomizedFont = canUse[Math.floor(Math.random() * canUse.length)].selectorName;
                console.debug(`New random font: ${randomizedFont}`)
            }
        }

        // show font
        if (hoverFlipped) {
            itemElement.style.setProperty("--font-family-japanese", defaultFont);
            itemElement.style.setProperty("--font-family-japanese-hover", randomizedFont);
        } else {
            itemElement.style.setProperty("--font-family-japanese", randomizedFont);
            itemElement.style.setProperty("--font-family-japanese-hover", defaultFont);
        }
    }

    /** Inserts CSS and sets event listeners */
    function setup() {
        itemElement = /** @type {HTMLElement} */ (document.getElementsByClassName(itemElementClass)[0]);
        defaultFont = getDefaultFont();
        itemElement.style.opacity = "0";

        console.debug(`Default font is ${defaultFont}`);
        // @ts-ignore
        const /** @type {any[]} */ fontData = JSON5.parse(GM_getResourceText("fonts"));
        fontPool = fontData.map((f) => new Font(f));
        for (const font of fontPool) {
            if (font.categories.length === 0) {
                fontsPerCategory.get(null)?.push(font);
            } else {
                for (const cat of font.categories) {
                    if (!fontsPerCategory.has(cat)) {
                        fontsPerCategory.set(cat, [])
                    }

                    fontsPerCategory.get(cat)?.push(font);
                }
            }
        }
        console.debug("Known fonts", fontPool);
        console.debug("Available categories are", [...fontsPerCategory.keys()]);

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
                font-family: ${defaultFont} !important;
            }
            .font_recommended::before {
                content: '⭐️';
                font-size: 1.1em;
            }

            /* on mouse hovering, show default font */
            .${itemElementClass} {
                font-family: var(--font-family-japanese);
            }
            .${itemElementClass}:hover {
                font-family: var(--font-family-japanese-hover);
            }
        `);

        itemElement.style.setProperty("--font-family-japanese-hover", defaultFont);

        // on answer submission, invert hovering event
        //  - normal  : default font
        //  - hovering: randomized font
        global.addEventListener("didAnswerQuestion", () => updateRandomFont(false, true));

        // on advancing to next item question, randomize font again
        global.addEventListener("willShowNextQuestion", (e) => updateRandomFont(true, false, e.detail.subject.characters));

        // on reverting an answer by DoubleCheckScript, reroll random font and fix inverting of hovering
        global.addEventListener("didUnanswerQuestion", () => updateRandomFont(true, false));

        // add event to reroll randomized font
        global.addEventListener("keydown", (e) => {
            if (e.key === ';') { updateRandomFont(true, false); }
        });
    }
})(window);
