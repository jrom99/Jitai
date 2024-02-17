interface willShowNextQuestionEventDetail {
    questionType: "meaning" | "reading";
    subject: {
        auxiliary_meanings: any[];
        auxiliary_readings: any[];
        characters: string;
        id: number;
        kanji: any[];
        meanings: string[];
        readings: {readings: string; pronunciations: any[]}[];
        subject_category: string | "Vocabulary";
        type: string | "Vocabulary";
    }
}

interface CustomEventMap {
    "willShowNextQuestion": CustomEvent<willShowNextQuestionEventDetail>;
}

/**
 * Patch event related functions to deal with custom events
 */
declare global {
    interface Window {
        addEventListener<K extends keyof CustomEventMap>(type: K,
            listener: (this: Window, ev: CustomEventMap[K]) => void,
            options?: boolean | AddEventListenerOptions | undefined): void;
        dispatchEvent<K extends keyof CustomEventMap>(ev: CustomEventMap[K]): boolean;
    }
    interface Document {
        addEventListener<K extends keyof CustomEventMap>(type: K,
            listener: (this: Document, ev: CustomEventMap[K]) => void,
            options?: boolean | AddEventListenerOptions | undefined): void;
        dispatchEvent<K extends keyof CustomEventMap>(ev: CustomEventMap[K]): boolean;
    }
    interface HTMLElement {
        addEventListener<K extends keyof CustomEventMap>(type: K,
            listener: (this: HTMLElement, ev: CustomEventMap[K]) => void,
            options?: boolean | AddEventListenerOptions | undefined): void;
        dispatchEvent<K extends keyof CustomEventMap>(ev: CustomEventMap[K]): boolean;
    }
}

export { };
