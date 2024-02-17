// This definition is a subset of the API reference of Wanikani Open Framework
// https://github.com/rfindley/wanikani-open-framework

interface TabsetComponent {
    type: "tabset";
    content: {
        [id: string]: Component;
    }
}

interface PageComponent {
    type: "page";
    label: string;
    hover_tip?: string;
    content: {
        [id: string]: Component;
    }
}

interface SectionComponent {
    type: "section";
    label: string;
}

interface DividerComponent {
    type: "divider";
}

interface GroupComponent {
    type: "group";
    label: string;
    content: {
        [id: string]: Component;
    }
}

interface ListComponent {
    type: "list";
    label: string;
    multi?: boolean;
    size?: number;
    hover_tip?: string;
    default?: string;
    full_width?: boolean;
    validate?: (value: string, config: ListComponent) => boolean | string | { valid: boolean, msg: string };
    on_change?: () => void;
    path?: string;
    content: {
        [id: string]: Component;
    }
}

interface DropdownComponent {
    type: "dropdown";
    label: string;
    hover_tip?: string;
    default?: string;
    full_width?: boolean;
    validate?: (value: string, config: DropdownComponent) => boolean | string | { valid: boolean, msg: string };
    on_change?: () => void;
    path?: string;
    content: {
        [key: string]: string;
    }
}

interface CheckboxComponent {
    type: "checkbox";
    label: string;
    hover_tip?: string;
    default?: boolean;
    full_width?: boolean;
    validate?: (value: boolean, config: CheckboxComponent) => boolean | string | { valid: boolean, msg: string };
    on_change?: () => void;
    path?: string;
}

interface InputComponent {
    type: "input";
    subtype?: string;
    label: string;
    hover_tip?: string;
    placeholder?: string;
    default?: string;
    full_width?: boolean;
    validate?: (value: string, config: InputComponent) => boolean | string | { valid: boolean, msg: string };
    on_change?: () => void;
    path?: string;
}

interface NumberComponent {
    type: "number";
    label: string;
    hover_tip?: string;
    placeholder?: string;
    default?: number;
    min?: number;
    max?: number;
    full_width?: boolean;
    validate?: (value: number, config: NumberComponent) => boolean | string | { valid: boolean, msg: string };
    on_change?: () => void;
    path?: string;
}

interface TextComponent {
    type: "text";
    label: string;
    hover_tip?: string;
    placeholder?: string;
    default?: string;
    match?: RegExp;
    full_width?: boolean;
    validate?: (value: string, config: TextComponent) => boolean | string | { valid: boolean, msg: string };
    on_change?: () => void;
    path?: string;
}

interface ColorComponent {
    type: "color";
    label: string;
    hover_tip?: string;
    default?: string;
    full_width?: boolean;
    validate?: (value: string, config: ColorComponent) => boolean | string | { valid: boolean, msg: string };
    on_change?: () => void;
    path?: string;
}

interface ButtonComponent {
    type: "button";
    label: string;
    text?: string;
    hover_tip?: string;
    full_width?: boolean;
    on_change?: () => void;
    path?: string;
    on_click: (name: string, config: ButtonComponent, on_change: () => Promise) => void;
}

interface HtmlComponent {
    type: "html";
    label?: string;
    html: string;
}

type Component =
    | TabsetComponent
    | PageComponent
    | SectionComponent
    | DividerComponent
    | GroupComponent
    | ListComponent
    | DropdownComponent
    | CheckboxComponent
    | InputComponent
    | NumberComponent
    | TextComponent
    | ColorComponent
    | ButtonComponent
    | HtmlComponent

class Dialog {
    public open: () => void;
    public save: () => Promise;
    public load: () => Promise;
    public refresh: () => Promise;
}

interface JitaiSettings {
    fonts: {
        [font: string]: {
            useFont: boolean;
            frequency: number;
        }
    }
}

interface wkof {
    /** A function for loading framework modules. */
    include(modules: string): Promise<any>;
    /**  A function for triggering a callback when a module is ready to use. */
    ready(modules: string): Promise<any>;

    /** The `Settings` module provides a simple way to create a Settings dialog for your script with minimal work. */
    readonly Settings: {
        /**
         * A constructor function for building a Settings dialog.
         * @param config - An object describing the settings dialog
         * @param script_id - A string ID for the script that defines where settings are stored.
         * @param title - A title for the dialog box.
         * @param content - A sub-object containing a collection of components that define the contents of the Settings dialog.
         * @param autosave - Whether clicking the Save button does not save the settings to storage.
         * @param background - Whether a semi-transparent background overlay will be used
         * @param pre_open - Callback for just _after_ the dialog opens, but before `open()` returns.
         * @param on_save - Callback for just after the user clicks the Save button and the settings are saved to storage, and before the dialog box is closed.
         * @param on_cancel - Callback for just after the user clicks the Cancel button and the settings are reverted, and before the dialog box is closed.
         * @param on_close - Callback for just after the `on_save` or `on_cancel` event, or when the user closes the window via the X
         * @param on_change - Callback for after the user modifies a setting in the dialog and the setting has passed validation (if any).
         * @param on_refresh - Callback for whenever a refresh of the dialog's interface has been requested.
         */
        new(config: {
            script_id: string;
            title: string;
            autosave?: boolean;
            background?: boolean;
            pre_open?: (dialog: Dialog) => void;
            on_save?: (settings: wkof["settings"][""]) => void;
            on_cancel?: (settings: wkof["settings"][""]) => void;
            on_close?: (settings: wkof["settings"][""]) => void;
            on_change?: (name: string, value: any, config: Object) => void;
            on_refresh?: (settings: wkof["settings"][""]) => void;
            content: { [id: string]: Content };
        }): Dialog;
    
        /**
         * Save the settings object located at wkof.settings[script_id] into storage.
         * @param script_id - A string that identifies the script whose settings are to be saved.
         * @returns A Promise that resolves when the save is complete.
         */
        static save(script_id: string): Promise<any>;
    
        /**
         * Loads the specified script's settings from storage. The loaded settings are returned in the resolved promise, and also at wkof.settings[script_id]
         * @param script_id A string that identifies the script whose settings are to be loaded.
         * @param defaults An object containing any default values that will be merged in the absence of their corresponding stored settings.
         * @returns A Promise that resolves with the loaded settings.
         */
        static load(script_id: string, defaults?: Object): Promise<any>;
    }

    /** The `Menu` module provides an interface for adding custom links to the Wanikani menu. */
    readonly Menu: {
        /** Retrieves a set of items, applies filters to select a subset of those items, and returns an array of the resulting items.
         * @param config - An object describing the link to be installed.
         * @param name - A unique identifier string for the link to be inserted.
         * @param submenu - A string containing the name of a submenu to (create and) insert the link under.
         * @param title - A string containing the text of the link.
         * @param class - A string containing any class names to be added to the <li> element.
         * @param callback - A callback function to be called when the link is clicked.
        */
        static insert_script_link(config: {
            name: string;
            submenu?: string;
            title: string;
            class?: string;
            on_click: () => void;
        }): Promise<any>;
    }

    readonly settings: { jitai: JitaiSettings };
}

declare var wkof: wkof;
