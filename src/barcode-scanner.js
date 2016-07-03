/*
 * Barcode-scanner.JS: Magnetic stripe/barcode USB and PS/2 scanner JavaScript implementation.
 * https://github.com/legionWFZ/Barcode-scanner.JS
 *
 * Copyright (C) 2013-2016 Alexander Pereverzev
 * Released under the MIT license.
 *
 */
"use strict";

(function (window) {

    // Public section.
    function Barcode () {
        this.listen = true;
        this.startSentinel = "";
        this.endSentinel = "";
        this.LRC = "(?:(?:\\r\\n)|\\n|\\r)";
    }

    function Track (startSentinel, endSentinel) {
        this.startSentinel = startSentinel;
        this.endSentinel = endSentinel;
    }

    function MagneticStripe () {
        this.listen = true;
        this.track1 = new Track ("%", "\\?");
        this.track2 = new Track (";", "\\?");
        this.track3 = new Track ("_", "\\?");
        this.LRC = "(?:(?:\\r\\n)|\\n|\\r)";
    }

    function Schema () {
        this.barcode = new Barcode ();
        this.magneticStripe = new MagneticStripe ();
    }

    // Private section.
    var settings
      , element
      , processing
      , compatibility
      , events
      , types;

    // Parameters:
    //  - target, [oncomplete], [onerror], [onreceive];
    //  - oncomplete, [onerror], [onreceive];
    //  - parameters = { target: ..., enabled: ...,  oncomplete: ..., ... }
    settings = function (parameters) {
        var options
          , target;

        if (types.isFunction (parameters)) {
            options = {
                oncomplete: arguments[0],
                onerror: arguments[1],
                onreceive: arguments[2]
            }
        } else if (types.isElement (parameters) || types.isJQueryObject (parameters)) {
            target = arguments[0];
            options = {
                oncomplete: arguments[1],
                onerror: arguments[2],
                onreceive: arguments[3]
            }
        } else {
            options = parameters || {};
            target = options.target;
        }

        for (var key in options) {
            if (settings.hasOwnProperty (key) && options [key] !== undefined) {
                settings [key] = options [key];
            }
        }

        target = target || element || window;
        if (types.isJQueryObject (target)) {
            target = target[0];   // $( selector )[0]
        }
        if (target === window || types.isElement (target)) {
            if (target === window && !window.addEventListener && !window.attachEvent) {
                target = document;  // IE have no window.attachEvent
            }
        } else {
            throw new TypeError ("DOM element expected");
        }
        if (target !== element)
        {
            if (element) {
                if (element.removeEventListener) {
                    element.removeEventListener ("keypress", keypress, false);
                } else {
                    if (element.detachEvent) {
                        element.detachEvent ("onkeypress", keypress);
                    }
                }
            }
            if (target.addEventListener) {
                target.addEventListener ("keypress", keypress, false);
            } else {
                if (target.attachEvent) {
                    target.attachEvent ("onkeypress", keypress);
                }
            }
            element = target;
        }

        return settings;
    }

    extend (settings, {
        enabled: true,
        oncomplete: null,
        onerror: null,
        onreceive: null,
        schema: new Schema (),
        sensitivity: 30, // ms.
        preventDefault: true,
        stopPropagation: true,

        Decode: function (raw, schema) {
            schema = schema || new Schema ();
            extend (this, decode (raw, schema));
        },
        Schema: Schema
    });

    processing = {
        active: false,
        compatibility: compatibility (),
        original: null,
        raw: "",
        timer: null
    }

    compatibility = compatibility ();

    events = {
        create: {
            keyPress: function (original) {
                var event;

                if (document.createEvent) {
                    if (compatibility.keyboardEvent) {
                        event = document.createEvent ("KeyboardEvent");
                    } else {
                        event = document.createEvent ("Event");
                    }
                } else {
                    event = document.createEventObject ();
                    event.type = "keypress";
                }

                var bubbles
                    , cancelable
                    , view
                    , ctrlKey
                    , altKey
                    , shiftKey
                    , metaKey
                    , keyIdentifier
                    , keyCode
                    , charCode
                    , char;

                bubbles = true;
                cancelable = true;
                view = document.defaultView;
                altKey = false;
                ctrlKey = false;
                shiftKey = false;
                metaKey = false;
                keyIdentifier = original.data.keyIdentifier;
                keyCode = original.which;
                charCode = original.which;
                char = String.fromCharCode (original.which);

                redefine(event, "char", compatibility, char);
                redefine(event, "charCode", compatibility, charCode);
                redefine(event, "key", compatibility, char);
                redefine(event, "keyCode", compatibility, charCode);
                redefine(event, "which", compatibility, charCode);

                if (compatibility.initKeyboardEvent) {
                    event.initKeyboardEvent ("keypress", bubbles, cancelable, view, keyIdentifier, ctrlKey, altKey, shiftKey, keyCode, charCode);
                } else if (compatibility.initKeyEvent) {
                    event.initKeyEvent ("keypress", bubbles, cancelable, view, ctrlKey, altKey, shiftKey, metaKey, keyCode, charCode);
                } else if (compatibility.initEvent) {
                    event.initEvent ("keypress", bubbles, cancelable);
                    clone (event, original.data);
                } else {
                    clone (event, original.data);
                }

                if (original.target.focus)
                    original.target.focus ();

                return event;

                function clone (to, from) {
                    var key;

                    for (key in from) {
                        if (from.hasOwnProperty (key) && from [key]) {
                            to [key] = from [key];
                        }
                    }
                }

                function redefine (event, key, compatibility, value) {
                    if (compatibility[key])
                    {
                        delete event [key];
                        Object.defineProperty (event, key, { value: value });
                    }
                }
            },

            textInput: function (original) {

                if (compatibility.textEvent) {
                    var event
                      , key;

                    key = String.fromCharCode (original.which);

                    event = document.createEvent ("TextEvent");
                    event.initTextEvent ("textInput", true, true, document.defaultView, key, 0x01, original.locale);

                    return event;
                }
            },

            propertyChange: function (original) {
                if (compatibility.msie) {
                    var event;

                    if (document.createEvent) {
                        event = document.createEvent ("Event");
                        if (event.initEvent) {
                            var bubbles
                              , cancelable;
                            bubbles = true;
                            cancelable = true;
                            event.initEvent ("propertychange", bubbles, cancelable);
                        }
                    } else {
                        event = document.createEventObject ();
                        event.type = "propertychange";
                    }

                    return event;
                }
            },

            input: function (original) {
                var event;

                if (document.createEvent) {
                    event = document.createEvent ("Event");
                    if (event.initEvent) {
                        var bubbles
                          , cancelable;
                        bubbles = true;
                        cancelable = true;
                        event.initEvent ("input", bubbles, cancelable);
                    }
                } else {
                    // Not supported by IE9-.
                }

                return event;
            }
        },

        dispatch: function (target, type, event) {
            if (event) {
                if (target.dispatchEvent) {
                    return target.dispatchEvent (event);
                } else {
                    if (target.fireEvent) {
                        var cancelable;
                        cancelable = true;
                        return target.fireEvent ("on" + type, event, cancelable);
                    }
                }
            }

            return true;
        },

        stop: function (event, preventDefault, stopPropagation) {
            if (preventDefault) {
                if (event.preventDefault) {
                    event.preventDefault ()
                } else {
                    event.returnValue = false;
                }
            }

            if (stopPropagation) {
                if (event.stopPropagation) {
                    event.stopPropagation ();
                } else {
                    event.cancelBubble = false;
                }
                if (event.stopImmediatePropagation) {
                    event.stopImmediatePropagation ();
                }
            }

            if (preventDefault) {
                return false;
            }
        }
    }

    types = {
        isObject: function (suspect) {
            return (suspect !== null && typeof suspect === 'object');
        },

        isFunction: function (suspect) {
            return (!!suspect && {}.toString.call (suspect) === '[object Function]');
        },

        isElement: function (suspect) {
            if (typeof Node === "object") {
                return (suspect instanceof Node);
            } else {
                return (!!suspect && typeof suspect === "object" && typeof suspect.nodeType === "number" && typeof suspect.nodeName === "string");
            }
        },

        isJQueryObject: function (suspect) {
            return (jQuery && suspect instanceof jQuery);
        }
    }

    // Global object extension.
    window.scanner = settings ();

    // Private section.
    function begin () {
        var source;

        if (settings.schema.barcode.listen && (settings.schema.barcode.endSentinel || settings.schema.barcode.LRC)) {
            source =
                ("(?:^%SB[0-9]+%EB%LB$)")
                    .replace (/%SB/g, settings.schema.barcode.startSentinel)
                    .replace (/%EB/g, settings.schema.barcode.endSentinel)
                    .replace (/%LB/g, settings.schema.barcode.LRC);
        }
        if (source && settings.schema.magneticStripe.listen) {
            source += "|";
        }
        if (settings.schema.magneticStripe.listen) {
            source +=
                ("(?:^%S1.+%E1%LS$)|" +
                 "(?:^%S2.+%E2%LS$)|" +
                 "(?:^%S3.+%E3%LS$)|" +
                 "(?:^%S1.+%E1%LS%S2.+%E2%LS$)|" +
                 "(?:^%S1.+%E1%LS%S3.+%E3%LS$)|" +
                 "(?:^%S2.+%E2%LS%S3.+%E3%LS$)|" +
                 "(?:^%S1.+%E1%LS%S2.+%E2%LS%S3.+%E3%LS$)")
                    .replace (/%S1/g, settings.schema.magneticStripe.track1.startSentinel)
                    .replace (/%E1/g, settings.schema.magneticStripe.track1.endSentinel)
                    .replace (/%S2/g, settings.schema.magneticStripe.track2.startSentinel)
                    .replace (/%E2/g, settings.schema.magneticStripe.track2.endSentinel)
                    .replace (/%S3/g, settings.schema.magneticStripe.track3.startSentinel)
                    .replace (/%E3/g, settings.schema.magneticStripe.track3.endSentinel)
                    .replace (/%LS/g, settings.schema.magneticStripe.LRC);
        }

        processing.active = true;
        processing.endingTest = new RegExp (source);
    }

    function compatibility () {
        var result
          , event
          , error;

        result = {
            keyboardEvent: false,
                initKeyboardEvent: false,
                initKeyEvent: false,
                initEvent: false,
                    char: false,
                    charCode: false,
                    key: false,
                    keyCode: false,
                    which: false,
            textEvent: false,
            msie: false,
            msie9: false
        };

        if (document.createEvent) {
            try {
                event = document.createEvent ("KeyboardEvent");
                result.keyboardEvent = true;
            }
            catch (error) {
                event = document.createEvent ("Event");
                result.keyboardEvent = false;
            }
        } else {
            event = document.createEventObject ();
            result.keyboardEvent = false;
        }
        result.initKeyboardEvent = !!event.initKeyboardEvent;
        result.initKeyEvent = !!event.initKeyEvent;
        result.initEvent = !!event.initEvent;

        result.char = checkRedefinition (event, "char");
        result.charCode = checkRedefinition (event, "charCode");
        result.key = checkRedefinition (event, "key");
        result.keyCode = checkRedefinition (event, "keyCode");
        result.which = checkRedefinition (event, "which");

        if (document.createEvent) {
            try {
                event = document.createEvent ("TextEvent");
                result.textEvent = !!event.initTextEvent;
            }
            catch (error) {
                result.textEvent = false;
            }
        } else {
            result.textEvent = false;
        }

        result.msie = !!document.createEventObject;
        result.msie9 = (document.createEventObject && document.createEvent);

        return result;

        function checkRedefinition (event, key) {
            var error;

            if (key in event)
            {
                try {
                    delete event [key];
                    Object.defineProperty(event, key, { value: 49 });
                    return true;
                }
                catch (error) {
                    return false;
                }
            } else {
                return false;
            }
        }
    }

    function concat (receiver, source) {
        if (receiver) {
            receiver += "\n";
        }
        receiver = (receiver || "") + source;
        return receiver;
    }

    function decode (raw, schema) {
        var data
          , error;
            
        data = {
            raw: raw,
            barcode: {
                present: false,
                valid: true,
                code: "",
                type: ""
            },
            magneticStripe: {
                present: false,
                valid: true,
                track1: "",
                track2: "",
                track3: ""
            }
        };

        var source;

        if (schema.barcode.listen) {
            source =
                "^%SB([0-9]+)%EB(?:%LB){0,1}$"
                    .replace (/%SB/g, schema.barcode.startSentinel)
                    .replace (/%EB/g, schema.barcode.endSentinel)
                    .replace (/%LB/g, schema.barcode.LRC);
            data.barcode.code = ((new RegExp (source).exec (raw)) || [,""])[1];
            data.barcode.present = !!data.barcode.code;
        }

        if (schema.magneticStripe.listen && !data.barcode.present) {
            var result;
            source =
                ("^(%S1([^%E1%LS]+)%E1(?:%LS){0,1})")
                    .replace (/%S1/g, schema.magneticStripe.track1.startSentinel)
                    .replace (/%E1/g, schema.magneticStripe.track1.endSentinel)
                    .replace (/%LS/g, schema.magneticStripe.LRC);
            result = ((new RegExp (source).exec (raw)) || [,,""]);
            data.magneticStripe.track1 = result[2];
            if (data.magneticStripe.track1)
                raw = raw.substr (result[1].length);
            source =
                ("^(%S2([^%E2%LS]+)%E2(?:%LS){0,1})")
                    .replace (/%S2/g, schema.magneticStripe.track2.startSentinel)
                    .replace (/%E2/g, schema.magneticStripe.track2.endSentinel)
                    .replace (/%LS/g, schema.magneticStripe.LRC);
            result = ((new RegExp (source).exec (raw)) || [,,""]);
            data.magneticStripe.track2 = result[2];
            if (data.magneticStripe.track2)
                raw = raw.substr (result[1].length);
            source =
                ("^(%S3([^%E3%LS]+)%E3(?:%LS){0,1}$)")
                    .replace (/%S3/g, schema.magneticStripe.track3.startSentinel)
                    .replace (/%E3/g, schema.magneticStripe.track3.endSentinel)
                    .replace (/%LS/g, schema.magneticStripe.LRC);
            result = ((new RegExp (source).exec (raw)) || [,,""]);
            data.magneticStripe.track3 = result[2];
            if (data.magneticStripe.track3)
                raw = raw.substr (result[1].length);

            data.magneticStripe.present = !!(data.magneticStripe.track1 + data.magneticStripe.track2 + data.magneticStripe.track3);

            if (data.magneticStripe.present) {
                if (data.magneticStripe.track1 && !((data.magneticStripe.track1.length <=  76) && /([0-9]|[A-Z]|[\u003a\u003b\u003d\u002b\u0028\u0029\u002d\u0027\u0022\u0021\u0040\u0023\u005e\u0026\u002a\u003c\u003e\u002f\u005c])+/.test (data.magneticStripe.track1))) {
                    data.magneticStripe.valid = false;
                    error = concat (error, "Magnetics stripe: incorrect track #1");
                }
                if (data.magneticStripe.track2 && !((data.magneticStripe.track2.length <=  37) && /([0-9]|=)+/.test (data.magneticStripe.track2))) {
                    data.magneticStripe.valid = false;
                    error = concat (error, "Magnetics stripe: incorrect track #2");
                }
                if (data.magneticStripe.track3 && !((data.magneticStripe.track3.length <= 104) && /([0-9]|=)+/.test (data.magneticStripe.track3))) {
                    data.magneticStripe.valid = false;
                    error = concat (error, "Magnetics stripe: incorrect track #3");
                }
                if (raw.length) {
                    data.magneticStripe.valid = false;
                    error = concat (error, "Magnetics stripe: unexpected data");
                }
            }
        }

        if (!data.barcode.present && !data.magneticStripe.present) {
            if (raw) {
                error = concat (error, "Dataset not recognized");
            } else {
                error = concat (error, "Empty dataset");
            }
        }
        if (error)
            data.error = new Error (error);

        return data;
    }

    function disabled () {
        return !(
            processing.active ||
                (settings.enabled &&
                (settings.oncomplete || settings.onerror || settings.onreceive) &&
                (settings.schema.barcode.listen || settings.schema.magneticStripe.listen))
        );
    }

    function end () {
        if (!processing.active) {
            return;
        }

        window.clearTimeout (processing.timer);

        var data;

        if (processing.raw.length == 1) {
            release ();
        } else {
            data = decode (processing.raw, settings.schema);
        }

        processing.active = false;
        processing.timer = null;
        processing.raw = "";
        processing.original = null;
        processing.endingTest = null;

        if (data) {
            var callback;
            if (data.error) {
                callback = settings.onerror;
            } else {
                callback = settings.oncomplete;
            }
            if (callback && !types.isFunction (callback)) {
                throw new TypeError ("Function expected");
            }
            callback (data);
        }
    }

    function extend(destination, source) {
        for (var property in source) {
            destination[property] = source[property];
        }
        return destination;
    }

    function grab (event) {
        var target
          , which
          , key;

        if (!processing.active) {
            target = event.target || event.srcElement;
            if (target.nodeName == "INPUT" && /date|datetime-local|month|time|week/i.test (target.type)) {
                return;
            }
        }

        if (event.which == null) {
            if (event.charCode == null) {
                which = event.keyCode;
            } else {
                which = event.charCode;
            }
        } else {
            which = event.which;
        }
        key = String.fromCharCode (which);

        if (!processing.active) {
            if ((settings.schema.barcode.listen &&
                (settings.schema.barcode.startSentinel ? settings.schema.barcode.startSentinel : "0123456789").indexOf (key) != -1) ||
                (settings.schema.magneticStripe.listen &&
                   (key == settings.schema.magneticStripe.track1.startSentinel ||
                    key == settings.schema.magneticStripe.track2.startSentinel ||
                    key == settings.schema.magneticStripe.track3.startSentinel))) {
                begin ();
            } else {
                return;
            }
        }

        if (settings.onreceive) {
            if (processing.raw.length) {
                var callback;
                callback = settings.onreceive;
                if (callback && !types.isFunction (callback)) {
                    throw new TypeError ("Function expected");
                }

                if (processing.raw.length == 1) {
                    callback (events.create.keyPress (processing.original));
                }
                callback (event);
            }
        }

        processing.raw += key;

        if (processing.endingTest.test (processing.raw)) {
            end ();
            return events.stop (event, settings.preventDefault, settings.stopPropagation);
        }

        if (!processing.original) {
            processing.original = {
                target: event.target || event.srcElement,
                which: event.which || event.charCode || event.keyCode,
                data: {
                    char: event.char,
                    charCode: event.charCode,
                    key: event.key,
                    keyCode:  event.keyCode,
                    keyIdentifier: event.keyIdentifier,
                    srcElement: event.srcElement,
                    target: event.target,
                    which: event.which
                }
            };
        }

        window.clearTimeout (processing.timer);
        processing.timer = window.setTimeout (end, settings.sensitivity);

        return events.stop (event, settings.preventDefault, settings.stopPropagation);
    }

    function hex (char) {
        var str;
        str = "";

        if (char) {
            var length
              , part;

            length = char.length;

            while (length) {
                part = "0000" + char.charCodeAt (length - 1).toString (16);
                str = "\\u" + part.substring (part.length - 4) + str;
                length--;
            }
        }

        return str;
    }

    function keypress (event) {
        if (processing.releasing) {
            return;
        }

        if (!disabled ()) {
            event = event || window.event;

            if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey || event.repeat) {
                if (processing.active) {
                    end ();
                }
            } else {
                return grab (event);
            }
        }
    }

    function release () {

        var eventsChain;

        processing.releasing = true;

        if (press (processing.original)) {
            if (processing.original.target.nodeName == "TEXTAREA" ||
               (processing.original.target.nodeName == "INPUT" && !/button|checkbox|color|date|datetime-local|file|image|month|radio|range|reset|submit|time|week/i.test (processing.original.target.type))) {

                eventsChain = text (processing.original) &&
                              compatibility.msie9;  // Unlike Webkit IE9+ don't automatically dispatch events: oninsert, oninput.
                if (eventsChain) {
                    property (processing.original);
                    insert (processing.original);
                    input (processing.original);
                }
            }
        }

        processing.releasing = false;

        function press (original) {
            return events.dispatch (original.target, "keypress", events.create.keyPress (original));
        }

        function text (original) {
            return events.dispatch (original.target, "textinput", events.create.textInput (original));
        }

        function insert (original) {
            var key
              , selection
              , text;

            key = String.fromCharCode (original.which);

            text = original.target.value;
            selection = getSelection (original.target, text);

            text = text.substr (0, selection.start) + key + text.substr (selection.end, text.length);

            original.target.value = text;

            moveCursor (original.target, selection.start + 1, text);

            function getSelection (element, text) {
                var selection
                  , range;

                selection = {
                    start: text.length,
                    end: text.length
                };

                if ("selectionStart" in element) {
                    selection.start = element.selectionStart;
                    selection.end = element.selectionEnd;
                } else {
                    if (document.selection) {
                        // Textarea Cursor Position in Internet Explorer.
                        // © 2006 Jake Roberts.
                        // <http://linebyline.blogspot.com/2006/11/element-cursor-position-in-internet.html>
                        range = document.selection.createRange ().duplicate ();
                        if (range.parentElement () == element) {
                            var before_range
                              , after_range;

                            if (element.nodeName == "TEXTAREA")
                            {
                                before_range = document.body.createTextRange ();
                                before_range.moveToElementText (element);
                            } else {
                                before_range = element.createTextRange ();
                            }
                            before_range.setEndPoint ("EndToStart", range);

                            if (element.nodeName == "TEXTAREA")
                            {
                                after_range = document.body.createTextRange ();
                                after_range.moveToElementText (element);
                            } else {
                                after_range = element.createTextRange ();
                            }
                            after_range.setEndPoint ("StartToEnd", range);

                            var before_finished
                              , selection_finished
                              , after_finished;

                            before_finished = false;
                            selection_finished = false;
                            after_finished = false;

                            var before_text
                              , untrimmed_before_text
                              , selection_text
                              , untrimmed_selection_text
                              , after_text
                              , untrimmed_after_text;

                            before_text = untrimmed_before_text = before_range.text;
                            selection_text = untrimmed_selection_text = range.text;
                            after_text = untrimmed_after_text = after_range.text;

                            do {
                                if (!before_finished) {
                                    if (before_range.compareEndPoints ("StartToEnd", before_range) == 0) {
                                        before_finished = true;
                                    } else {
                                        before_range.moveEnd ("character", -1);
                                        if (before_range.text == before_text) {
                                            untrimmed_before_text += "\r\n";
                                        } else {
                                            before_finished = true;
                                        }
                                    }
                                }
                                if (!selection_finished) {
                                    if (range.compareEndPoints ("StartToEnd", range) == 0) {
                                        selection_finished = true;
                                    } else {
                                        range.moveEnd ("character", -1);
                                        if (range.text == selection_text) {
                                            untrimmed_selection_text += "\r\n";
                                        } else {
                                            selection_finished = true;
                                        }
                                    }
                                }
                                if (!after_finished) {
                                    if (after_range.compareEndPoints ("StartToEnd", after_range) == 0) {
                                        after_finished = true;
                                    } else {
                                        after_range.moveEnd ("character", -1);
                                        if (after_range.text == after_text) {
                                            untrimmed_after_text += "\r\n";
                                        } else {
                                            after_finished = true;
                                        }
                                    }
                                }
                            } while ((!before_finished || !selection_finished || !after_finished));

                            selection.start = untrimmed_before_text.length;
                            selection.end = selection.start + untrimmed_selection_text.length;
                        }
                    }
                }

                return selection;
            }

            function moveCursor (element, position, text) {
                var range;

                if (element.setSelectionRange) {
                    element.focus ();
                    element.setSelectionRange (position, position);
                } else if (element.createTextRange) {
                    var beforeFFLF
                      , afterFFLF;

                    beforeFFLF = (text.substr (0, position).match (/(\r\n)/g) || []).length;
                    afterFFLF = (text.substr (position, text.length).match (/(\r\n)/g) || []).length;

                    range = element.createTextRange ();
                    range.moveStart ("character", position - beforeFFLF);
                    range.moveEnd ("character", position - text.length + afterFFLF);
                    range.select ();
                }
            }
        }

        function property (original) {
            return events.dispatch (original.target, "propertychange", events.create.propertyChange (original));
        }

        function input (original) {
            return events.dispatch (original.target, "input", events.create.input (original));
        }
    }

} (window));
