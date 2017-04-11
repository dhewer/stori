/*     _           _    _    
 *  __| |_ ___ _ _(_)  (_)___
 * (_-<  _/ _ \ '_| |_ | (_-<
 * /__/\__\___/_| |_(_)/ /__/
 * stori - v0.8.0    (__/  
 * Darren Hewer 2017
 * darrenhewer.com/stori
 * github.com/dhewer/stori
 */
(function($) {

    'use strict';

    var pluginName = 'stori';

    // ----------------------------------------------------------------------
    // Stori object

    $.Stori = function(root, options) {

        var self = this;

        // Default options
        self.defaults = {
            buttonBack: true,
            buttonBackHtml: '<button class="stori-button stori-back" title="Back"></button>',
            buttonForward: true,
            buttonForwardHtml: '<button class="stori-button stori-forward" title="Forward"></button>',
            buttonRestart: true,
            buttonRestartHtml: '<button class="stori-button stori-restart" title="Restart"></button>',
            controls: 'top',
            controlsHtml: false,
            debug: true,
            focus: true,
            history: 'clear',
            linear: false,
            linearDropDown: true,
            start: false,
            transition: 'fade',
            transitionSpeed: 250,
            warn: false
        };
        self.opts = {};

        // Internal options
        self.id = root.attr('id');
        if (!self.id) {
            if (self.opts.debug) console.warn('stori: Container element requires an id');
            return null;
        }
        self.historyName = 'stori_' + self.id;
        // Pointer keeps track of user's position in history
        self.pointer = 0;
        self.pointerName = 'stori_' + self.id + '_pointer';
        // linear root id name
        self.linearName = 'stori-' + self.id + '-p-';
        // Tracks whether this is the initial load or a subsequent refresh
        self.initialLoad = true;
        // Adds class to body to trigger hiding pages (allows pages to show when JS is off)
        $('body').addClass('stori-js');

        // ------------------------------------------------------------------
        // Setup functions

        /** 
         * init
         * Initializes options, calls other setup functions
         * @param object $options Options passed from user
         */
        self.init = function(options) {
            // Replace defaults with user options
            self.opts = $.extend({}, self.defaults, options);
            // Add .stori class to main element and hide children
            root.addClass('stori').children(':not(.stori-ignore)').addClass('stori-page').hide();
            // Fix user's options
            self.fixOpts();
            // Get history
            self.history = self.historyGet();
            // Setup pages if linear
            if (self.opts.linear) self.setupLinear();
            // Setup options
            self.setupOpts();
            // Insert controls
            self.setupControls();
            // Go to start page (last param false means don't add it to the history)
            self.pageGo(self.current, self.opts.transition, false);
        };

        /**
         * fixOpts
         * Fixes user options if they enter an alternative value
         */
        self.fixOpts = function() {
            // Fix user options (replace alternatives with actuals)
            if (self.opts.history && (self.opts.history.toUpperCase() === 'LOCAL' || self.opts.history.toUpperCase() === 'LOCALSTORAGE')) self.opts.history = 'keep';
            if (self.opts.history && self.opts.history.toUpperCase() === 'SESSIONSTORAGE') self.opts.history = 'session';
            if (self.opts.transition && self.opts.transition.toUpperCase() === 'NONE') self.opts.transition = false;
            if (self.opts.controls === false) self.opts.controls = 'none';
        };

        /**
         * setupOpts
         * Initializes options, calls other setup functions
         */
        self.setupOpts = function() {
            // Set start page
            self.opts.start = !self.opts.start ? $($(root.children())[0]) : $(self.opts.start);
            if (!self.opts.start || !self.opts.start.length) {
                if (self.opts.debug) console.warn('stori: Start element does not exist');
            }
            // Add start page if history is empty
            if (!self.history || !self.history.length) {
                self.historyAdd(self.opts.start);
            }
            // Set current page
            self.current = self.history[self.pointer];
        };

        /**
         * setuplinear
         * Initilaizes history when linear option is set
         */
        self.setupLinear = function() {
            var idCount = 0,
                pageName, select = '<select class="stori-pageList">';
            // Initialize history
            self.history = [];
            self.historyEmpty();
            root.addClass('stori-linear');
            // Add auto-generated ids to each page
            root.children(':not(.stori-ignore)').each(function() {
                pageName = self.linearName + idCount;
                $(this).attr('id', pageName);
                self.historyAdd('#' + pageName);
                idCount++;
                if (idCount === 0) self.opts.start = $('#' + pageName);
            });
            // Generate drop-down
            if (self.opts.linearDropDown) {
                for (var x = 0; x < self.history.length; x++) {
                    var title = '';
                    title = $(self.history[x]).attr('title');
                    select += '<option value="' + x + '">';
                    select += 'Page ' + (x + 1);
                    if (title) select += ': ' + title;
                    select += '</option>';
                }
                select += '</select>';
                self.selectHtml = select;
            }
        };

        /**
         * setupControls
         * Initializes controls (back & restart buttons)
         */
        self.setupControls = function() {
            var controls = self.opts.controls;
            if (controls !== 'none') {
                // Add bottom controls area
                if (controls === 'bottom' || controls === 'both') {
                    root.append('<div class="stori-controls stori-controls-default stori-controls-bottom stori-clearfix"></div>');
                }
                // Add top controls area
                if (controls === 'top' || controls === 'both') {
                    root.prepend('<div class="stori-controls stori-controls-default stori-controls-top stori-clearfix"></div>');
                }
                // Add custom controls HTML if provided
                if (self.opts.controlsHtml) {
                    root.find('.stori-controls').removeClass('stori-controls-default').append(self.opts.controlsHtml);
                } else {
                    // Add back button
                    if (self.opts.buttonBack) {
                        root.find('.stori-controls').append(self.opts.buttonBackHtml);
                    }
                    // Add forward button
                    if (self.opts.buttonForward) {
                        root.find('.stori-controls').append(self.opts.buttonForwardHtml);
                    }
                    // Add restart button
                    if (self.opts.buttonRestart) {
                        root.find('.stori-controls').append(self.opts.buttonRestartHtml);
                    }
                    // Add linear select dropdown
                    if (self.opts.linear && self.opts.linearDropDown) {
                        root.find('.stori-controls').append(self.selectHtml);
                    }
                }
            } // end if self.opts.controls
        };

        // ------------------------------------------------------------------
        // Page functions

        /**
         * pageGo
         * Moves to a specified page
         * @param string id The hashed target
         * @param (optional) string transition The type of transition to use
         * @param (optional) boolean addToHistory Add the target to history (default = true)
         */
        self.pageGo = function(id, transition, addToHistory) {
            var prev;
            // Defaults if none specified
            if (transition === undefined) transition = self.opts.transition;
            if (addToHistory === undefined) addToHistory = true;
            // Convert to id if passed an object
            id = self.o2e(id);
            // If target not found, abort
            if (!id || !$(id).length) return null;
            prev = self.current;
            if (addToHistory) {
                self.pointer++;
                // Cut off anything in history after pointer
                // (ex, for when the user goes back, then clicks on different page)
                self.history = self.history.slice(0, self.pointer);
                self.historyAdd(id);
            }
            // Hide "current" and show new
            self.pageHideShow(prev, id, transition);
            // Enable/disable controls
            self.current = self.history[self.pointer];
            self.controlsEnableDisable();
        };
        /* Catches clicks and runs pageGo */
        $(document).on('click', '#' + self.id + " a[href^='#'], #" + self.id + " [data-page^='#']", function(e) {
            var id = $(this).attr('href');
            // Ignore if element has any special stori classes
            if ($(this).is('.stori-ignore, .stori-back, .stori-forward, .stori-restart')) return null;
            // If element is not a link with href, see if it has a data-page
            if (!id) id = $(this).attr('data-page');
            // If element has neither href or data-page, abort
            if (!id || !$(id).length) {
                if (self.opts.debug) console.warn('stori: Target element does not exist');
                return null;
            }
            e.preventDefault();
            self.pageGo(id);
        });

        /**
         * pageHideShow
         * Hide one page (param 1) and show another (param 2)
         * Uses the pre-defined transition unless a third param is specified
         * @param string tohide The target id to hide
         * @param string toshow The target id to show
         * @param (optional) string Transition type ('fade', 'slide', 'none'/false)
         */
        self.pageHideShow = function(tohide, toshow, transition) {
            var speed = self.opts.transitionSpeed;
            tohide = self.e2o(tohide);
            toshow = self.e2o(toshow);
            if (transition === undefined) transition = self.opts.transition;
            // Fade transition
            // Need to wait until transition is done to set focus, otherwise it won't work
            if (transition === 'fade') {
                tohide.stop().fadeOut(speed, function() {
                    toshow.stop().fadeIn(speed, function() {
                        self.pageFocus();
                        self.initialLoad = false;
                    });
                });
                // Slide transition
            } else if (transition === 'slide') {
                tohide.stop().slideUp(speed, function() {
                    toshow.stop().slideDown(speed, function() {
                        self.pageFocus();
                        self.initialLoad = false;
                    });
                });
                // Normal instant hide/show
            } else {
                tohide.hide();
                toshow.show();
                self.pageFocus();
                self.initialLoad = false;
            }
        };

        /**
         * pageBack
         * Moves back one page in user history
         */
        self.pageBack = function() {
            var prev;
            if (!self.history || self.pointer <= 0) return null;
            // Keep record of current page to be hidden later
            prev = self.history[self.pointer];
            // Show new page
            self.pointer--;
            self.current = self.history[self.pointer];
            self.pageHideShow(prev, self.current);
            // Set history
            self.historySet(self.history);
            // Enable/disable controls
            self.controlsEnableDisable();
        };
        /* Catches clicks and runs pageBack */
        $(document).on('click', '#' + self.id + ' .stori-back:not(.stori-ignore)', function(e) {
            e.preventDefault();
            self.pageBack();
        });
        /* Catches touchscreen swipes and runs pageBack */
        $(document).on('swipeleft', '#' + self.id + ' .stori-back:not(.stori-ignore)', function(e) {
            e.preventDefault();
            self.pageBack();
        });

        /**
         * pageForward
         * Moves forward one page in user history
         */
        self.pageForward = function() {
            var prev;
            if (!self.history || self.pointer + 1 >= self.history.length) return null;
            // Keep record of current page to be hidden later
            prev = self.history[self.pointer];
            // Show new page
            self.pointer++;
            self.current = self.history[self.pointer];
            self.pageHideShow(prev, self.current);
            // Set history
            self.historySet(self.history);
            // Enable/disable controls
            self.controlsEnableDisable();
        };
        /* Catches clicks and runs pageForward */
        $(document).on('click', '#' + self.id + ' .stori-forward:not(.stori-ignore)', function(e) {
            e.preventDefault();
            self.pageForward();
        });

        /**
         * pageRestart
         * Clears history and resets start page to original value
         */
        self.pageRestart = function() {
            var prev = self.current;
            if (self.history.length <= 1) return null;
            // Reset pointer
            self.pointer = 0;
            // For non-linear type only: Clear history
            // (linear pages always keep entire page history)
            if (!self.opts.linear) {
                // Reset history to blank
                self.history = [];
                // Add the original start page to history
                self.historyAdd(self.opts.start);
            }
            // Set current
            self.current = '#' + self.opts.start.attr('id');
            // Show hide prev and show start page
            self.pageHideShow(prev, self.opts.start.attr('id'));
            // Enable/disable controls
            self.controlsEnableDisable();
        };
        /* Catches clicks and runs pageRestart */
        $(document).on('click', '#' + self.id + ' .stori-restart:not(.stori-ignore)', function(e) {
            e.preventDefault();
            self.pageRestart();
        });

        /**
         * pageFocus
         * Sets the focus on the current page to first focusable element
         */
        self.pageFocus = function() {
            var target = $(self.current).find("input, a, select, textarea, button").first();
            if (self.opts.focus && !self.initialLoad) {
                target.focus();
            }
        };

        /**
         * pageHistory
         * Returns history array
         * @returns array
         */
        self.pageHistory = function() {
            return self.history;
        };

        /**
         * pagePosition
         * Returns pointer (position in history)
         * @returns string
         */
        self.pagePosition = function() {
            return self.pointer;
        };

        /**
         * pageCurrent
         * Returns id of current page based on history & pointer
         * @returns string
         */
        self.pageCurrent = function() {
            return self.history[self.pointer];
        };

        /**
         * linear page change
         * Swaps page when linear dropbox box changes
         */
        root.on('change', 'select.stori-pageList', function(e) {
            var num = $(this).val(),
                target = self.linearName + num;
            self.pageGo(target, self.opts.transition, false);
            self.pointer = num;
            self.current = self.history[num];
            self.controlsEnableDisable();
        });

        // ------------------------------------------------------------------
        // History functions

        /**
         * historyAdd
         * Adds a new page to the history (both in array and storage)
         * @param object/string elem Object to add (could also be string with id)
         */
        self.historyAdd = function(target) {
            // Format target (converts element name to object if necessary)
            target = self.o2e(target);
            // Add new page
            self.history.push(target);
            // Save current page
            self.current = self.history[self.pointer];
            self.historySet(self.history);
        };

        /**
         * historyGet
         * Returns stori history as array (loads from local/sessionStorage)
         * @returns array History array
         */
        self.historyGet = function() {
            var history, historyArray = [];
            if (self.opts.history === 'session') {
                history = sessionStorage.getItem(self.historyName);
                self.pointer = sessionStorage.getItem(self.pointerName);
            } else {
                history = localStorage.getItem(self.historyName);
                self.pointer = localStorage.getItem(self.pointerName);
            }
            if (!self.pointer || self.pointer === 'null') self.pointer = 0;
            if (history) historyArray = history.split(',');
            return historyArray;
        };

        /**
         * historySet
         * Sets stori history to new value (saves to localStorage)
         * @param array History array
         */
        self.historySet = function(history) {
            if (self.opts.history === 'session') {
                // Using +'' converts array to string
                sessionStorage.setItem(self.historyName, history + '');
                sessionStorage.setItem(self.pointerName, self.pointer);
            } else {
                localStorage.setItem(self.historyName, history + '');
                localStorage.setItem(self.pointerName, self.pointer);
            }
        };

        /**
         * historyEmpty
         * Empties all pages from history (sets to empty string)
         */
        self.historyEmpty = function() {
            if (self.opts.history === 'session') {
                sessionStorage.setItem(self.historyName, '');
            } else {
                localStorage.setItem(self.historyName, '');
            }
        };

        /**
         * historyDestroy
         * Removes localStorage entry for history entirely
         */
        self.historyDestroy = function() {
            if (self.opts.history === 'session') {
                sessionStorage.removeItem(self.historyName);
                sessionStorage.removeItem(self.pointerName);
            } else {
                localStorage.removeItem(self.historyName);
                localStorage.removeItem(self.pointerName);
            }
        };

        // ------------------------------------------------------------------
        // Controls functions

        /**
         * controlsEnableDisable
         * Enable or disable the various control area buttons based on current history
         */
        self.controlsEnableDisable = function() {
            // Back button
            if (self.opts.buttonBack) {
                if (self.pointer <= 0) {
                    root.find('.stori-controls .stori-back').addClass('stori-disabled').prop('disabled', true);
                } else {
                    root.find('.stori-controls .stori-back').removeClass('stori-disabled').prop('disabled', false);
                }
            }
            // Forward button
            if (self.opts.buttonForward) {
                if (self.pointer + 1 >= self.history.length) {
                    root.find('.stori-controls .stori-forward').addClass('stori-disabled').prop('disabled', true);
                } else {
                    root.find('.stori-controls .stori-forward').removeClass('stori-disabled').prop('disabled', false);
                }
            }
            // Restart button
            if (self.opts.buttonRestart) {
                if (self.history.length <= 1) {
                    root.find('.stori-controls .stori-restart').addClass('stori-disabled').prop('disabled', true);
                } else {
                    root.find('.stori-controls .stori-restart').removeClass('stori-disabled').prop('disabled', false);
                }
            }
            // linear dropdown
            if (self.opts.linear && self.opts.linearDropDown) {
                root.find('select.stori-pageList').val(self.pointer);
            }
        };

        // ------------------------------------------------------------------
        // Utility functions

        /**
         * e2o (element2object)
         * Converts an element name to a jQuery object
         * @param string/object target The target to check
         * @returns object
         */
        self.e2o = function(target) {
            if (typeof target === 'string') {
                target = target.trim();
                // Add a hash if just id passed
                if (!target.startsWith('#')) target = '#' + target;
                target = $(target);
            }
            if (!target || !target.length) {
                if (self.opts.debug) console.warn('stori: Page doesn\'t exist or missing id');
                return null;
            }
            return target;
        };

        /**
         * o2e (object2element)
         * Converts a jQuery object to an id
         * @param string/object target The target to check
         * @returns object
         */
        self.o2e = function(target) {
            if (!target) {
                if (self.opts.debug) console.warn('stori: Page doesn\'t exist or missing id');
                return null;
            }
            if (typeof target !== 'string') {
                target = target.attr('id');
                if (!target) {
                    if (self.opts.debug) console.warn('stori: Page doesn\'t exist or missing id');
                    return null;
                }
            }
            // Generally adding a hash will be needed ...
            if (!target.startsWith('#')) target = '#' + target;
            return target;
        };

        // Window.onbeforeunload
        // Warns user they will lose progress if appropriate
        window.onbeforeunload = function() {
            var msg, result;
            if (self.opts.warn) {
                if (self.opts.history === 'clear') {
                    msg = 'You will lose your progress if you leave this page. Continue?';
                } else if (self.opts.history === 'session') {
                    msg = 'You will lose your progress if you close this window. Continue?';
                }
                result = window.confirm(msg);
                if (!result) return false;
            }
            if (self.opts.history === 'clear') self.historyDestroy();
        }

        // Window.unload:
        // Destroy history (delete from localStorage) when user leaves page
        $(window).unload(function() {
            if (self.opts.history === 'clear') self.historyDestroy();
        });

        // Returns self (for jQuery chain)
        return self.init(options);
    }; // end of Stori object

    // ----------------------------------------------------------------------
    // Setup as jQuery plugin

    $.fn.stori = function(opts) {
        return this.each(function(index, elem) {
            var $this = $(elem);

            // Don't initialize twice
            if ($this.data(pluginName) instanceof $.Stori) return;

            // Load a function
            if (typeof opts === 'string' && $this.data(pluginName)) {
                var call;
                call = $this.data(pluginName)[opts[0]];
                if ($.isFunction(call)) {
                    return call.apply($this, opts[1]);
                }
            }

            // Set up a new Stori object
            return $this.data(pluginName, new $.Stori($this, opts));
        });
    }; // end of jQuery plugin setup

    // The end.    
}(jQuery));