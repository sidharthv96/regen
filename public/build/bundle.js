
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.29.7' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    	  path: basedir,
    	  exports: {},
    	  require: function (path, base) {
          return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
        }
    	}, fn(module, module.exports), module.exports;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var types = {
      ROOT       : 0,
      GROUP      : 1,
      POSITION   : 2,
      SET        : 3,
      RANGE      : 4,
      REPETITION : 5,
      REFERENCE  : 6,
      CHAR       : 7,
    };

    const INTS = () => [{ type: types.RANGE , from: 48, to: 57 }];

    const WORDS = () => {
      return [
        { type: types.CHAR, value: 95 },
        { type: types.RANGE, from: 97, to: 122 },
        { type: types.RANGE, from: 65, to: 90 }
      ].concat(INTS());
    };

    const WHITESPACE = () => {
      return [
        { type: types.CHAR, value: 9 },
        { type: types.CHAR, value: 10 },
        { type: types.CHAR, value: 11 },
        { type: types.CHAR, value: 12 },
        { type: types.CHAR, value: 13 },
        { type: types.CHAR, value: 32 },
        { type: types.CHAR, value: 160 },
        { type: types.CHAR, value: 5760 },
        { type: types.RANGE, from: 8192, to: 8202 },
        { type: types.CHAR, value: 8232 },
        { type: types.CHAR, value: 8233 },
        { type: types.CHAR, value: 8239 },
        { type: types.CHAR, value: 8287 },
        { type: types.CHAR, value: 12288 },
        { type: types.CHAR, value: 65279 }
      ];
    };

    const NOTANYCHAR = () => {
      return [
        { type: types.CHAR, value: 10 },
        { type: types.CHAR, value: 13 },
        { type: types.CHAR, value: 8232 },
        { type: types.CHAR, value: 8233 },
      ];
    };

    // Predefined class objects.
    var words = () => ({ type: types.SET, set: WORDS(), not: false });
    var notWords = () => ({ type: types.SET, set: WORDS(), not: true });
    var ints = () => ({ type: types.SET, set: INTS(), not: false });
    var notInts = () => ({ type: types.SET, set: INTS(), not: true });
    var whitespace = () => ({ type: types.SET, set: WHITESPACE(), not: false });
    var notWhitespace = () => ({ type: types.SET, set: WHITESPACE(), not: true });
    var anyChar = () => ({ type: types.SET, set: NOTANYCHAR(), not: true });

    var sets = {
    	words: words,
    	notWords: notWords,
    	ints: ints,
    	notInts: notInts,
    	whitespace: whitespace,
    	notWhitespace: notWhitespace,
    	anyChar: anyChar
    };

    var util = createCommonjsModule(function (module, exports) {
    const CTRL = '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^ ?';
    const SLSH = { '0': 0, 't': 9, 'n': 10, 'v': 11, 'f': 12, 'r': 13 };

    /**
     * Finds character representations in str and convert all to
     * their respective characters
     *
     * @param {String} str
     * @return {String}
     */
    exports.strToChars = function(str) {
      /* jshint maxlen: false */
      var chars_regex = /(\[\\b\])|(\\)?\\(?:u([A-F0-9]{4})|x([A-F0-9]{2})|(0?[0-7]{2})|c([@A-Z[\\\]^?])|([0tnvfr]))/g;
      str = str.replace(chars_regex, function(s, b, lbs, a16, b16, c8, dctrl, eslsh) {
        if (lbs) {
          return s;
        }

        var code = b ? 8 :
          a16   ? parseInt(a16, 16) :
          b16   ? parseInt(b16, 16) :
          c8    ? parseInt(c8,   8) :
          dctrl ? CTRL.indexOf(dctrl) :
          SLSH[eslsh];

        var c = String.fromCharCode(code);

        // Escape special regex characters.
        if (/[[\]{}^$.|?*+()]/.test(c)) {
          c = '\\' + c;
        }

        return c;
      });

      return str;
    };


    /**
     * turns class into tokens
     * reads str until it encounters a ] not preceeded by a \
     *
     * @param {String} str
     * @param {String} regexpStr
     * @return {Array.<Array.<Object>, Number>}
     */
    exports.tokenizeClass = (str, regexpStr) => {
      /* jshint maxlen: false */
      var tokens = [];
      var regexp = /\\(?:(w)|(d)|(s)|(W)|(D)|(S))|((?:(?:\\)(.)|([^\]\\]))-(?:\\)?([^\]]))|(\])|(?:\\)?([^])/g;
      var rs, c;


      while ((rs = regexp.exec(str)) != null) {
        if (rs[1]) {
          tokens.push(sets.words());

        } else if (rs[2]) {
          tokens.push(sets.ints());

        } else if (rs[3]) {
          tokens.push(sets.whitespace());

        } else if (rs[4]) {
          tokens.push(sets.notWords());

        } else if (rs[5]) {
          tokens.push(sets.notInts());

        } else if (rs[6]) {
          tokens.push(sets.notWhitespace());

        } else if (rs[7]) {
          tokens.push({
            type: types.RANGE,
            from: (rs[8] || rs[9]).charCodeAt(0),
            to: rs[10].charCodeAt(0),
          });

        } else if ((c = rs[12])) {
          tokens.push({
            type: types.CHAR,
            value: c.charCodeAt(0),
          });

        } else {
          return [tokens, regexp.lastIndex];
        }
      }

      exports.error(regexpStr, 'Unterminated character class');
    };


    /**
     * Shortcut to throw errors.
     *
     * @param {String} regexp
     * @param {String} msg
     */
    exports.error = (regexp, msg) => {
      throw new SyntaxError('Invalid regular expression: /' + regexp + '/: ' + msg);
    };
    });

    var wordBoundary = () => ({ type: types.POSITION, value: 'b' });
    var nonWordBoundary = () => ({ type: types.POSITION, value: 'B' });
    var begin = () => ({ type: types.POSITION, value: '^' });
    var end = () => ({ type: types.POSITION, value: '$' });

    var positions = {
    	wordBoundary: wordBoundary,
    	nonWordBoundary: nonWordBoundary,
    	begin: begin,
    	end: end
    };

    var lib = (regexpStr) => {
      var i = 0, l, c,
        start = { type: types.ROOT, stack: []},

        // Keep track of last clause/group and stack.
        lastGroup = start,
        last = start.stack,
        groupStack = [];


      var repeatErr = (i) => {
        util.error(regexpStr, `Nothing to repeat at column ${i - 1}`);
      };

      // Decode a few escaped characters.
      var str = util.strToChars(regexpStr);
      l = str.length;

      // Iterate through each character in string.
      while (i < l) {
        c = str[i++];

        switch (c) {
          // Handle escaped characters, inclues a few sets.
          case '\\':
            c = str[i++];

            switch (c) {
              case 'b':
                last.push(positions.wordBoundary());
                break;

              case 'B':
                last.push(positions.nonWordBoundary());
                break;

              case 'w':
                last.push(sets.words());
                break;

              case 'W':
                last.push(sets.notWords());
                break;

              case 'd':
                last.push(sets.ints());
                break;

              case 'D':
                last.push(sets.notInts());
                break;

              case 's':
                last.push(sets.whitespace());
                break;

              case 'S':
                last.push(sets.notWhitespace());
                break;

              default:
                // Check if c is integer.
                // In which case it's a reference.
                if (/\d/.test(c)) {
                  last.push({ type: types.REFERENCE, value: parseInt(c, 10) });

                // Escaped character.
                } else {
                  last.push({ type: types.CHAR, value: c.charCodeAt(0) });
                }
            }

            break;


          // Positionals.
          case '^':
            last.push(positions.begin());
            break;

          case '$':
            last.push(positions.end());
            break;


          // Handle custom sets.
          case '[':
            // Check if this class is 'anti' i.e. [^abc].
            var not;
            if (str[i] === '^') {
              not = true;
              i++;
            } else {
              not = false;
            }

            // Get all the characters in class.
            var classTokens = util.tokenizeClass(str.slice(i), regexpStr);

            // Increase index by length of class.
            i += classTokens[1];
            last.push({
              type: types.SET,
              set: classTokens[0],
              not,
            });

            break;


          // Class of any character except \n.
          case '.':
            last.push(sets.anyChar());
            break;


          // Push group onto stack.
          case '(':
            // Create group.
            var group = {
              type: types.GROUP,
              stack: [],
              remember: true,
            };

            c = str[i];

            // If if this is a special kind of group.
            if (c === '?') {
              c = str[i + 1];
              i += 2;

              // Match if followed by.
              if (c === '=') {
                group.followedBy = true;

              // Match if not followed by.
              } else if (c === '!') {
                group.notFollowedBy = true;

              } else if (c !== ':') {
                util.error(regexpStr,
                  `Invalid group, character '${c}'` +
                  ` after '?' at column ${i - 1}`);
              }

              group.remember = false;
            }

            // Insert subgroup into current group stack.
            last.push(group);

            // Remember the current group for when the group closes.
            groupStack.push(lastGroup);

            // Make this new group the current group.
            lastGroup = group;
            last = group.stack;
            break;


          // Pop group out of stack.
          case ')':
            if (groupStack.length === 0) {
              util.error(regexpStr, `Unmatched ) at column ${i - 1}`);
            }
            lastGroup = groupStack.pop();

            // Check if this group has a PIPE.
            // To get back the correct last stack.
            last = lastGroup.options ?
              lastGroup.options[lastGroup.options.length - 1] : lastGroup.stack;
            break;


          // Use pipe character to give more choices.
          case '|':
            // Create array where options are if this is the first PIPE
            // in this clause.
            if (!lastGroup.options) {
              lastGroup.options = [lastGroup.stack];
              delete lastGroup.stack;
            }

            // Create a new stack and add to options for rest of clause.
            var stack = [];
            lastGroup.options.push(stack);
            last = stack;
            break;


          // Repetition.
          // For every repetition, remove last element from last stack
          // then insert back a RANGE object.
          // This design is chosen because there could be more than
          // one repetition symbols in a regex i.e. `a?+{2,3}`.
          case '{':
            var rs = /^(\d+)(,(\d+)?)?\}/.exec(str.slice(i)), min, max;
            if (rs !== null) {
              if (last.length === 0) {
                repeatErr(i);
              }
              min = parseInt(rs[1], 10);
              max = rs[2] ? rs[3] ? parseInt(rs[3], 10) : Infinity : min;
              i += rs[0].length;

              last.push({
                type: types.REPETITION,
                min,
                max,
                value: last.pop(),
              });
            } else {
              last.push({
                type: types.CHAR,
                value: 123,
              });
            }
            break;

          case '?':
            if (last.length === 0) {
              repeatErr(i);
            }
            last.push({
              type: types.REPETITION,
              min: 0,
              max: 1,
              value: last.pop(),
            });
            break;

          case '+':
            if (last.length === 0) {
              repeatErr(i);
            }
            last.push({
              type: types.REPETITION,
              min: 1,
              max: Infinity,
              value: last.pop(),
            });
            break;

          case '*':
            if (last.length === 0) {
              repeatErr(i);
            }
            last.push({
              type: types.REPETITION,
              min: 0,
              max: Infinity,
              value: last.pop(),
            });
            break;


          // Default is a character that is not `\[](){}?+*^$`.
          default:
            last.push({
              type: types.CHAR,
              value: c.charCodeAt(0),
            });
        }

      }

      // Check if any groups have not been closed.
      if (groupStack.length !== 0) {
        util.error(regexpStr, 'Unterminated group');
      }

      return start;
    };

    var types_1 = types;
    lib.types = types_1;

    /* eslint indent: 4 */


    // Private helper class
    class SubRange {
        constructor(low, high) {
            this.low = low;
            this.high = high;
            this.length = 1 + high - low;
        }

        overlaps(range) {
            return !(this.high < range.low || this.low > range.high);
        }

        touches(range) {
            return !(this.high + 1 < range.low || this.low - 1 > range.high);
        }

        // Returns inclusive combination of SubRanges as a SubRange.
        add(range) {
            return new SubRange(
                Math.min(this.low, range.low),
                Math.max(this.high, range.high)
            );
        }

        // Returns subtraction of SubRanges as an array of SubRanges.
        // (There's a case where subtraction divides it in 2)
        subtract(range) {
            if (range.low <= this.low && range.high >= this.high) {
                return [];
            } else if (range.low > this.low && range.high < this.high) {
                return [
                    new SubRange(this.low, range.low - 1),
                    new SubRange(range.high + 1, this.high)
                ];
            } else if (range.low <= this.low) {
                return [new SubRange(range.high + 1, this.high)];
            } else {
                return [new SubRange(this.low, range.low - 1)];
            }
        }

        toString() {
            return this.low == this.high ?
                this.low.toString() : this.low + '-' + this.high;
        }
    }


    class DRange {
        constructor(a, b) {
            this.ranges = [];
            this.length = 0;
            if (a != null) this.add(a, b);
        }

        _update_length() {
            this.length = this.ranges.reduce((previous, range) => {
                return previous + range.length;
            }, 0);
        }

        add(a, b) {
            var _add = (subrange) => {
                var i = 0;
                while (i < this.ranges.length && !subrange.touches(this.ranges[i])) {
                    i++;
                }
                var newRanges = this.ranges.slice(0, i);
                while (i < this.ranges.length && subrange.touches(this.ranges[i])) {
                    subrange = subrange.add(this.ranges[i]);
                    i++;
                }
                newRanges.push(subrange);
                this.ranges = newRanges.concat(this.ranges.slice(i));
                this._update_length();
            };

            if (a instanceof DRange) {
                a.ranges.forEach(_add);
            } else {
                if (b == null) b = a;
                _add(new SubRange(a, b));
            }
            return this;
        }

        subtract(a, b) {
            var _subtract = (subrange) => {
                var i = 0;
                while (i < this.ranges.length && !subrange.overlaps(this.ranges[i])) {
                    i++;
                }
                var newRanges = this.ranges.slice(0, i);
                while (i < this.ranges.length && subrange.overlaps(this.ranges[i])) {
                    newRanges = newRanges.concat(this.ranges[i].subtract(subrange));
                    i++;
                }
                this.ranges = newRanges.concat(this.ranges.slice(i));
                this._update_length();
            };

            if (a instanceof DRange) {
                a.ranges.forEach(_subtract);
            } else {
                if (b == null) b = a;
                _subtract(new SubRange(a, b));
            }
            return this;
        }

        intersect(a, b) {
            var newRanges = [];
            var _intersect = (subrange) => {
                var i = 0;
                while (i < this.ranges.length && !subrange.overlaps(this.ranges[i])) {
                    i++;
                }
                while (i < this.ranges.length && subrange.overlaps(this.ranges[i])) {
                    var low = Math.max(this.ranges[i].low, subrange.low);
                    var high = Math.min(this.ranges[i].high, subrange.high);
                    newRanges.push(new SubRange(low, high));
                    i++;
                }
            };

            if (a instanceof DRange) {
                a.ranges.forEach(_intersect);
            } else {
                if (b == null) b = a;
                _intersect(new SubRange(a, b));
            }
            this.ranges = newRanges;
            this._update_length();
            return this;
        }

        index(index) {
            var i = 0;
            while (i < this.ranges.length && this.ranges[i].length <= index) {
                index -= this.ranges[i].length;
                i++;
            }
            return this.ranges[i].low + index;
        }

        toString() {
            return '[ ' + this.ranges.join(', ') + ' ]';
        }

        clone() {
            return new DRange(this);
        }

        numbers() {
            return this.ranges.reduce((result, subrange) => {
                var i = subrange.low;
                while (i <= subrange.high) {
                    result.push(i);
                    i++;
                }
                return result;
            }, []);
        }

        subranges() {
            return this.ranges.map((subrange) => ({
                low: subrange.low,
                high: subrange.high,
                length: 1 + subrange.high - subrange.low
            }));
        }
    }

    var lib$1 = DRange;

    const types$1  = lib.types;


    var randexp = class RandExp {
      /**
       * @constructor
       * @param {RegExp|String} regexp
       * @param {String} m
       */
      constructor(regexp, m) {
        this._setDefaults(regexp);
        if (regexp instanceof RegExp) {
          this.ignoreCase = regexp.ignoreCase;
          this.multiline = regexp.multiline;
          regexp = regexp.source;

        } else if (typeof regexp === 'string') {
          this.ignoreCase = m && m.indexOf('i') !== -1;
          this.multiline = m && m.indexOf('m') !== -1;
        } else {
          throw new Error('Expected a regexp or string');
        }

        this.tokens = lib(regexp);
      }


      /**
       * Checks if some custom properties have been set for this regexp.
       *
       * @param {RandExp} randexp
       * @param {RegExp} regexp
       */
      _setDefaults(regexp) {
        // When a repetitional token has its max set to Infinite,
        // randexp won't actually generate a random amount between min and Infinite
        // instead it will see Infinite as min + 100.
        this.max = regexp.max != null ? regexp.max :
          RandExp.prototype.max != null ? RandExp.prototype.max : 100;

        // This allows expanding to include additional characters
        // for instance: RandExp.defaultRange.add(0, 65535);
        this.defaultRange = regexp.defaultRange ?
          regexp.defaultRange : this.defaultRange.clone();

        if (regexp.randInt) {
          this.randInt = regexp.randInt;
        }
      }


      /**
       * Generates the random string.
       *
       * @return {String}
       */
      gen() {
        return this._gen(this.tokens, []);
      }


      /**
       * Generate random string modeled after given tokens.
       *
       * @param {Object} token
       * @param {Array.<String>} groups
       * @return {String}
       */
      _gen(token, groups) {
        var stack, str, n, i, l;

        switch (token.type) {
          case types$1.ROOT:
          case types$1.GROUP:
            // Ignore lookaheads for now.
            if (token.followedBy || token.notFollowedBy) { return ''; }

            // Insert placeholder until group string is generated.
            if (token.remember && token.groupNumber === undefined) {
              token.groupNumber = groups.push(null) - 1;
            }

            stack = token.options ?
              this._randSelect(token.options) : token.stack;

            str = '';
            for (i = 0, l = stack.length; i < l; i++) {
              str += this._gen(stack[i], groups);
            }

            if (token.remember) {
              groups[token.groupNumber] = str;
            }
            return str;

          case types$1.POSITION:
            // Do nothing for now.
            return '';

          case types$1.SET:
            var expandedSet = this._expand(token);
            if (!expandedSet.length) { return ''; }
            return String.fromCharCode(this._randSelect(expandedSet));

          case types$1.REPETITION:
            // Randomly generate number between min and max.
            n = this.randInt(token.min,
              token.max === Infinity ? token.min + this.max : token.max);

            str = '';
            for (i = 0; i < n; i++) {
              str += this._gen(token.value, groups);
            }

            return str;

          case types$1.REFERENCE:
            return groups[token.value - 1] || '';

          case types$1.CHAR:
            var code = this.ignoreCase && this._randBool() ?
              this._toOtherCase(token.value) : token.value;
            return String.fromCharCode(code);
        }
      }


      /**
       * If code is alphabetic, converts to other case.
       * If not alphabetic, returns back code.
       *
       * @param {Number} code
       * @return {Number}
       */
      _toOtherCase(code) {
        return code + (97 <= code && code <= 122 ? -32 :
          65 <= code && code <= 90  ?  32 : 0);
      }


      /**
       * Randomly returns a true or false value.
       *
       * @return {Boolean}
       */
      _randBool() {
        return !this.randInt(0, 1);
      }


      /**
       * Randomly selects and returns a value from the array.
       *
       * @param {Array.<Object>} arr
       * @return {Object}
       */
      _randSelect(arr) {
        if (arr instanceof lib$1) {
          return arr.index(this.randInt(0, arr.length - 1));
        }
        return arr[this.randInt(0, arr.length - 1)];
      }


      /**
       * expands a token to a DiscontinuousRange of characters which has a
       * length and an index function (for random selecting)
       *
       * @param {Object} token
       * @return {DiscontinuousRange}
       */
      _expand(token) {
        if (token.type === lib.types.CHAR) {
          return new lib$1(token.value);
        } else if (token.type === lib.types.RANGE) {
          return new lib$1(token.from, token.to);
        } else {
          let drange = new lib$1();
          for (let i = 0; i < token.set.length; i++) {
            let subrange = this._expand(token.set[i]);
            drange.add(subrange);
            if (this.ignoreCase) {
              for (let j = 0; j < subrange.length; j++) {
                let code = subrange.index(j);
                let otherCaseCode = this._toOtherCase(code);
                if (code !== otherCaseCode) {
                  drange.add(otherCaseCode);
                }
              }
            }
          }
          if (token.not) {
            return this.defaultRange.clone().subtract(drange);
          } else {
            return this.defaultRange.clone().intersect(drange);
          }
        }
      }


      /**
       * Randomly generates and returns a number between a and b (inclusive).
       *
       * @param {Number} a
       * @param {Number} b
       * @return {Number}
       */
      randInt(a, b) {
        return a + Math.floor(Math.random() * (1 + b - a));
      }


      /**
       * Default range of characters to generate from.
       */
      get defaultRange() {
        return this._range = this._range || new lib$1(32, 126);
      }

      set defaultRange(range) {
        this._range = range;
      }


      /**
       *
       * Enables use of randexp with a shorter call.
       *
       * @param {RegExp|String| regexp}
       * @param {String} m
       * @return {String}
       */
      static randexp(regexp, m) {
        var randexp;
        if(typeof regexp === 'string') {
          regexp = new RegExp(regexp, m);
        }

        if (regexp._randexp === undefined) {
          randexp = new RandExp(regexp, m);
          regexp._randexp = randexp;
        } else {
          randexp = regexp._randexp;
          randexp._setDefaults(regexp);
        }
        return randexp.gen();
      }


      /**
       * Enables sugary /regexp/.gen syntax.
       */
      static sugar() {
        /* eshint freeze:false */
        RegExp.prototype.gen = function() {
          return RandExp.randexp(this);
        };
      }
    };

    /* src/App.svelte generated by Svelte v3.29.7 */
    const file = "src/App.svelte";

    // (27:1) {#if !error}
    function create_if_block(ctx) {
    	let label;
    	let input;
    	let t0;
    	let br;
    	let t1;
    	let t2;
    	let t3;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			label = element("label");
    			input = element("input");
    			t0 = space();
    			br = element("br");
    			t1 = space();
    			t2 = text(/*count*/ ctx[3]);
    			t3 = text(" strings coming right up!");
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "max", "50");
    			attr_dev(input, "class", "svelte-17itz6v");
    			add_location(input, file, 28, 3, 596);
    			add_location(br, file, 29, 3, 650);
    			add_location(label, file, 27, 2, 585);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, input);
    			set_input_value(input, /*count*/ ctx[3]);
    			append_dev(label, t0);
    			append_dev(label, br);
    			append_dev(label, t1);
    			append_dev(label, t2);
    			append_dev(label, t3);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "change", /*input_change_input_handler*/ ctx[6]),
    					listen_dev(input, "input", /*input_change_input_handler*/ ctx[6])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*count*/ 8) {
    				set_input_value(input, /*count*/ ctx[3]);
    			}

    			if (dirty & /*count*/ 8) set_data_dev(t2, /*count*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(27:1) {#if !error}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let input;
    	let t4;
    	let t5;
    	let pre;
    	let t6;
    	let mounted;
    	let dispose;
    	let if_block = !/*error*/ ctx[4] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			t0 = text("Hello ");
    			t1 = text(/*name*/ ctx[0]);
    			t2 = text("!");
    			t3 = space();
    			input = element("input");
    			t4 = space();
    			if (if_block) if_block.c();
    			t5 = space();
    			pre = element("pre");
    			t6 = text(/*data*/ ctx[2]);
    			attr_dev(h1, "class", "svelte-17itz6v");
    			add_location(h1, file, 24, 1, 492);
    			attr_dev(input, "placeholder", "Enter Regex");
    			attr_dev(input, "class", "svelte-17itz6v");
    			add_location(input, file, 25, 1, 516);
    			add_location(pre, file, 33, 1, 710);
    			attr_dev(main, "class", "svelte-17itz6v");
    			add_location(main, file, 23, 0, 484);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(h1, t2);
    			append_dev(main, t3);
    			append_dev(main, input);
    			set_input_value(input, /*regex*/ ctx[1]);
    			append_dev(main, t4);
    			if (if_block) if_block.m(main, null);
    			append_dev(main, t5);
    			append_dev(main, pre);
    			append_dev(pre, t6);

    			if (!mounted) {
    				dispose = listen_dev(input, "input", /*input_input_handler*/ ctx[5]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data_dev(t1, /*name*/ ctx[0]);

    			if (dirty & /*regex*/ 2 && input.value !== /*regex*/ ctx[1]) {
    				set_input_value(input, /*regex*/ ctx[1]);
    			}

    			if (!/*error*/ ctx[4]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(main, t5);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*data*/ 4) set_data_dev(t6, /*data*/ ctx[2]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let { name } = $$props;
    	let regex = "[-+]?[0-9]{1,16}[.][0-9]{1,6}";
    	let data = "";
    	let count = 5;
    	let error = false;
    	const writable_props = ["name"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		regex = this.value;
    		$$invalidate(1, regex);
    	}

    	function input_change_input_handler() {
    		count = to_number(this.value);
    		$$invalidate(3, count);
    	}

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({ RandExp: randexp, name, regex, data, count, error });

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("regex" in $$props) $$invalidate(1, regex = $$props.regex);
    		if ("data" in $$props) $$invalidate(2, data = $$props.data);
    		if ("count" in $$props) $$invalidate(3, count = $$props.count);
    		if ("error" in $$props) $$invalidate(4, error = $$props.error);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*regex, count*/ 10) {
    			 {
    				try {
    					const text = [];
    					const randexp$1 = new randexp(regex);

    					for (let i = 0; i < count; i++) {
    						text.push(randexp$1.gen());
    					}

    					$$invalidate(2, data = text.join("\n"));
    					$$invalidate(4, error = false);
    				} catch(_a) {
    					$$invalidate(4, error = true);
    					$$invalidate(2, data = "Bad Regex :(");
    				}
    			}
    		}
    	};

    	return [
    		name,
    		regex,
    		data,
    		count,
    		error,
    		input_input_handler,
    		input_change_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[0] === undefined && !("name" in props)) {
    			console.warn("<App> was created without expected prop 'name'");
    		}
    	}

    	get name() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
        target: document.body,
        props: {
            name: 'regen'
        }
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
