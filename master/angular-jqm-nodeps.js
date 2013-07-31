/*! angular-jqm - v0.0.1-SNAPSHOT - 2013-07-31
 * https://github.com/opitzconsulting/angular-jqm
 * Copyright (c) 2013 OPITZ CONSULTING GmbH; Licensed MIT */
(function(window, angular) {
    "use strict";
/**
 * @ngdoc overview
 * @name jqm
 * @description
 *
 * 'jqm' is the one module that contains all jqm code.
 */
var jqmModule = angular.module("jqm", ["jqm-templates", "ngMobile", "ajoslin.scrolly"]);
jqmModule.config(['$provide', function ($provide) {
    $provide.decorator('$animator', ['$delegate', function ($animator) {

        patchedAnimator.enabled = $animator.enabled;
        return patchedAnimator;

        function patchedAnimator(scope, attr) {
            var animation = $animator(scope, attr),
                _leave = animation.leave,
                _enter = animation.enter;
            animation.enter = patchedEnter;
            animation.leave = patchedLeave;
            return animation;

            // if animations are disabled or we have none
            // add the "ui-page-active" css class manually.
            // E.g. needed for the initial page.
            function patchedEnter(elements) {
                var i, el;
                if (!$animator.enabled() || !animationName("enter")) {
                    forEachPage(elements, function (element) {
                        angular.element(element).addClass("ui-page-active");
                    });
                }
                /*jshint -W040:true*/
                return _enter.apply(this, arguments);
            }

            function patchedLeave(elements) {
                if (!$animator.enabled() || !animationName("leave")) {
                    forEachPage(elements, function (element) {
                        angular.element(element).removeClass("ui-page-active");
                    });
                }
                /*jshint -W040:true*/
                return _leave.apply(this, arguments);
            }

            function forEachPage(elements, callback) {
                angular.forEach(elements, function (element) {
                    if (element.className && ~element.className.indexOf('ui-page')) {
                        callback(element);
                    }
                });
            }

            function animationName(type) {
                // Copied from AnimationProvider.
                var ngAnimateValue = scope.$eval(attr.ngAnimate);
                var className = ngAnimateValue ?
                    angular.isObject(ngAnimateValue) ? ngAnimateValue[type] : ngAnimateValue + '-' + type
                    : '';
                return className;
            }
        }
    }]);
}]);

var PAGE_ANIMATION_DEFS = {
    none: {
        sequential: true,
        fallback: 'none'
    },
    slide: {
        sequential: false,
        fallback: 'fade'
    },
    fade: {
        sequential: true,
        fallback: 'fade'
    },
    pop: {
        sequential: true,
        fallback: 'fade'
    },
    slidefade: {
        sequential: true,
        fallback: 'fade'
    },
    slidedown: {
        sequential: true,
        fallback: 'fade'
    },
    slideup: {
        sequential: true,
        fallback: 'fade'
    },
    flip: {
        sequential: true,
        fallback: 'fade'
    },
    turn: {
        sequential: true,
        fallback: 'fade'
    },
    flow: {
        sequential: true,
        fallback: 'fade'
    }
};

registerPageAnimations(PAGE_ANIMATION_DEFS);

function registerPageAnimations(animations) {
    var type;
    for (type in animations) {
        registerPageAnimation(type, false, 'enter');
        registerPageAnimation(type, true, 'enter');
        registerPageAnimation(type, false, 'leave');
        registerPageAnimation(type, true, 'leave');
    }
}

function registerPageAnimation(animationType, reverse, direction) {
    var ngName = "page-" + animationType;

    if (reverse) {
        ngName += "-reverse";
    }
    ngName += "-" + direction;

    jqmModule.animation(ngName, ['$animationComplete', '$sniffer', function (animationComplete, $sniffer) {
        var degradedAnimationType = maybeDegradeAnimation(animationType),
            activePageClass = "ui-page-active",
            toPreClass = "ui-page-pre-in",
            addClasses = degradedAnimationType + (reverse ? " reverse" : ""),
            removeClasses = "out in reverse " + degradedAnimationType,
            viewPortClasses = "ui-mobile-viewport-transitioning viewport-" + degradedAnimationType,
            animationDef = PAGE_ANIMATION_DEFS[degradedAnimationType];

        if (degradedAnimationType === 'none') {
            return {
                setup: setupNone,
                start: startNone
            };
        } else {
            if (direction === "leave") {
                addClasses += " out";
                removeClasses += " " + activePageClass;
                return {
                    setup: setupLeave,
                    start: start
                };
            } else {
                addClasses += " in";
                return {
                    setup: setupEnter,
                    start: start
                };
            }
        }

        // --------------

        function setupNone(element) {
            element = filterElementsWithParents(element);
            if (direction === "leave") {
                element.removeClass(activePageClass);
            } else {
                element.addClass(activePageClass);
            }
        }

        function startNone(element, done) {
            done();
        }

        function setupEnter(element) {
            var synchronization;
            element = filterElementsWithParents(element);
            synchronization = createSynchronizationIfNeeded(element.eq(0).parent(), "enter");
            synchronization.events.preEnter.listen(function() {
                // Set the new page to display:block but don't show it yet.
                // This code is from jquery mobile 1.3.1, function "createHandler".
                // Prevent flickering in phonegap container: see comments at #4024 regarding iOS
                element.css("z-index", -10);
                element.addClass(activePageClass + " " + toPreClass);
            });
            synchronization.events.enter.listen(function() {
                // Browser has settled after setting the page to display:block.
                // Now start the animation and show the page.
                element.addClass(addClasses);
                // Restores visibility of the new page: added together with $to.css( "z-index", -10 );
                element.css("z-index", "");
                element.removeClass(toPreClass);
            });
            synchronization.events.enterDone.listen(function() {
                element.removeClass(removeClasses);
            });

            synchronization.enter();
            return synchronization;
        }

        function setupLeave(element) {
            var synchronization,
                origElement = element;
            element = filterElementsWithParents(element);
            synchronization = createSynchronizationIfNeeded(element.eq(0).parent(), "leave");
            synchronization.events.leave.listen(function () {
                element.addClass(addClasses);
            });
            synchronization.events.leaveDone.listen(function () {
                element.removeClass(removeClasses);
            });
            synchronization.leave();
            return synchronization;
        }

        function start(element, done, synchronization) {
            synchronization.events.end.listen(done);
        }

        function createSynchronizationIfNeeded(parent, direction) {
            var sync = parent.data("animationSync");
            if (sync && sync.running[direction]) {
                // We already have a running animation, so stop it
                sync.stop();
                sync = null;
            }
            if (!sync) {
                if (animationDef.sequential) {
                    sync = sequentialSynchronization(parent);
                } else {
                    sync = parallelSynchronization(parent);
                }
                sync.events.start.listen(function () {
                    parent.addClass(viewPortClasses);
                });
                sync.events.end.listen(function () {
                    parent.removeClass(viewPortClasses);
                    parent.data("animationSync", null);
                });
                parent.data("animationSync", sync);
            }
            sync.running = sync.running || {};
            sync.running[direction] = true;
            return sync;
        }

        function filterElementsWithParents(element) {
            var i, res = angular.element();
            for (i = 0; i < element.length; i++) {
                if (element[i].nodeType === 1 && element[i].parentNode) {
                    res.push(element[i]);
                }
            }
            return res;
        }

        function maybeDegradeAnimation(animation) {
            if (!$sniffer.cssTransform3d) {
                // Fall back to simple animation in browsers that don't support
                // complex 3d animations.
                animation = PAGE_ANIMATION_DEFS[animation].fallback;
            }
            if (!$sniffer.animations) {
                animation = "none";
            }
            return animation;
        }

        function parallelSynchronization(parent) {
            var events = {
                    start: latch(),
                    preEnter: latch(),
                    enter: latch(),
                    enterDone: latch(),
                    leave: latch(),
                    leaveDone: latch(),
                    end: latch()
                },
                runningCount = 0;
            events.start.listen(function () {
                // setTimeout to allow
                // the browser to settle after the new page
                // has been set to display:block and before the css animation starts.
                // Without this animations are sometimes not shown,
                // unless you call window.scrollTo or click on a link (weired dependency...)
                window.setTimeout(function () {
                    events.enter.notify();
                    events.leave.notify();
                }, 0);
            });
            events.end.listen(animationComplete(parent, onAnimationComplete));
            events.end.listen(events.enterDone.notify);
            events.end.listen(events.leaveDone.notify);
            events.start.listen(events.preEnter.notify);

            return {
                enter: begin,
                leave: begin,
                stop: stop,
                events: events
            };

            function begin() {
                runningCount++;
                events.start.notify();
            }

            function stop() {
                events.leaveDone.notify();
                events.enterDone.notify();
                events.end.notify();
            }

            function onAnimationComplete() {
                runningCount--;
                if (runningCount === 0) {
                    events.end.notify();
                }
            }
        }

        function sequentialSynchronization(parent) {
            var events = {
                    start: latch(),
                    preEnter: latch(),
                    enter: latch(),
                    enterDone: latch(),
                    leave: latch(),
                    leaveDone: latch(),
                    end: latch()
                },
                hasEnter = false,
                hasLeave = false,
                _onAnimationComplete = angular.noop;
            events.end.listen(animationComplete(parent, onAnimationComplete));
            events.start.listen(events.leave.notify);
            events.leaveDone.listen(events.preEnter.notify);
            events.leaveDone.listen(events.enter.notify);
            events.leaveDone.listen(function() {
                if (hasEnter) {
                    _onAnimationComplete = events.enterDone.notify;
                } else {
                    events.enterDone.notify();
                }
            });
            // setTimeout to detect if a leave animation has been used.
            window.setTimeout(function () {
                if (!hasLeave) {
                    events.leaveDone.notify();
                }
            }, 0);
            events.enterDone.listen(events.end.notify);

            return {
                enter: enter,
                leave: leave,
                stop: stop,
                events: events
            };

            function enter() {
                hasEnter = true;
                events.start.notify();
            }

            function leave() {
                hasLeave = true;
                events.start.notify();
                _onAnimationComplete = events.leaveDone.notify;
            }

            function stop() {
                events.leaveDone.notify();
                events.enterDone.notify();
                events.end.notify();
            }

            function onAnimationComplete() {
                _onAnimationComplete();
            }

        }
    }]);

    function latch() {
        var _listeners = [],
            _notified = false;
        return {
            listen: listen,
            notify: notify
        };

        function listen(callback) {
            if (_notified) {
                callback();
            } else {
                _listeners.push(callback);
            }
        }

        function notify() {
            if (_notified) {
                return;
            }
            var i;
            for (i = 0; i < _listeners.length; i++) {
                _listeners[i]();
            }
            _notified = true;
        }
    }
}


/**
 * @ngdoc directive
 * @name jqm.directive:jqmCachingView
 * @restrict ECA
 *
 * @description
 * # Overview
 * `jqmCachingView` extends `jqmView` in the following way:
 *
 * - views are only compiled once and then stored in the `jqmViewCache`. By this, changes between views are very fast.
 * - controllers are still instantiated on every route change. Their changes to the scope get cleared
 *   when the view is left.
 *
 * Side effects:
 * - For animations between multiple routes that use the same template add the attribute `allow-same-view-animation`
 *   to the root of your view. Background: The DOM nodes and scope of the compiled template are reused for every view.
 *   With this attribute `jqmCachingView` will create two instances of the template internally.
 *   Example: Click on Moby and directly after this on Gatsby. Both routes use the same template and therefore
 *   the template has to contain `allow-same-view-animation`.
 *
 * @requires jqmViewCache
 *
 * @param {expression=} jqmCachingView angular expression evaluating to a route (optional). See `jqmView` for details.
 * @scope
 * @example
    <example module="jqmView">
      <file name="index.html">
          Choose:
          <a href="#/Book/Moby">Moby</a> |
          <a href="#/Book/Moby/ch/1">Moby: Ch1</a> |
          <a href="#/Book/Gatsby">Gatsby</a> |
          <a href="#/Book/Gatsby/ch/4?key=value">Gatsby: Ch4</a> |
          <a href="#/Book/Scarlet">Scarlet Letter</a><br/>

          <div jqm-caching-view style="height:300px"></div>
      </file>

      <file name="book.html">
        <div jqm-page allow-same-view-animation>
          <div jqm-header><h1>Book {{book.params.bookId}}</h1></div>
          The book contains ...
        </div>
      </file>

      <file name="chapter.html">
        <div jqm-page allow-same-view-animation>
          <div jqm-header><h1>Chapter {{chapter.params.chapterId}} of {{chapter.params.bookId}}</h1></div>
          This chapter contains ...
        </div>
      </file>

      <file name="script.js">
        angular.module('jqmView', ['jqm'], function($routeProvider) {
          $routeProvider.when('/Book/:bookId', {
            templateUrl: 'book.html',
            controller: BookCntl,
            controllerAs: 'book',
            animation: 'page-slide'
          });
          $routeProvider.when('/Book/:bookId/ch/:chapterId', {
            templateUrl: 'chapter.html',
            controller: ChapterCntl,
            controllerAs: 'chapter',
            animation: 'page-slide'
          });
        });

        function BookCntl($routeParams) {
          this.params = $routeParams;
        }

        function ChapterCntl($routeParams) {
          this.params = $routeParams;
        }
      </file>
    </example>
*/
jqmModule.directive('jqmCachingView', ['jqmViewDirective', 'jqmViewCache', '$injector',
    function (jqmViewDirectives, jqmViewCache, $injector) {
        return {
            restrict: 'ECA',
            controller: ['$scope', JqmCachingViewCtrl],
            require: 'jqmCachingView',
            compile: function(element, attr) {
                var links = [];
                angular.forEach(jqmViewDirectives, function (directive) {
                    links.push(directive.compile(element, attr));
                });
                return function (scope, element, attr, ctrl) {
                    angular.forEach(links, function (link) {
                        link(scope, element, attr, ctrl);
                    });
                };
            }
        };

        function JqmCachingViewCtrl($scope) {
            var self = this;
            angular.forEach(jqmViewDirectives, function (directive) {
                $injector.invoke(directive.controller, self, {$scope: $scope});
            });
            this.loadAndCompile = loadAndCompile;
            this.watchAttrName = 'jqmCachingView';
            this.onClearContent = onClearContent;

            // --------

            function loadAndCompile(templateUrl) {
                return jqmViewCache.load($scope, templateUrl).then(function (cacheEntry) {
                    var templateInstance = cacheEntry.next();
                    templateInstance.scope.$reconnect();
                    return templateInstance;
                });
            }

            function onClearContent(contents) {
                // Don't destroy the data of the elements when they are removed
                contents.remove = detachNodes;
            }

        }

        // Note: element.remove() would
        // destroy all data associated to those nodes,
        // e.g. widgets, ...
        function detachNodes() {
            /*jshint -W040:true*/
            var i, node, parent;
            for (i = 0; i < this.length; i++) {
                node = this[i];
                parent = node.parentNode;
                if (parent) {
                    parent.removeChild(node);
                }
            }
        }
}]);

/**
 * @ngdoc directive
 * @name jqm.directive:jqmCheckbox
 * @restrict A
 *
 * @description 
 * Creates a jquery mobile checkbox on the given element.
 * 
 * Anything inside the `jqm-checkbox` tag will be a label.
 *
 * @param {string=} ngModel Assignable angular expression to data-bind to.
 * @param {string=} disabled Whether this checkbox is disabled.
 * @param {string=} mini Whether this checkbox is mini.
 * @param {string=} iconpos The position of the icon for this element. "left" or "right".
 * @param {string=} ngTrueValue The value to which the expression should be set when selected.
 * @param {string=} ngFalseValue The value to which the expression should be set when not selected.
 *
 * @example
<example module="jqm">
  <file name="index.html">
    <div jqm-checkbox ng-model="checky">
      My value is: {{checky}}
    </div>
    <div jqm-checkbox mini="true" iconpos="right" ng-model="isDisabled">
      I've got some options. Toggle me to disable the guy below.
    </div>
    <div jqm-checkbox disabled="{{isDisabled ? 'disabled' : ''}}" 
      ng-model="disably" ng-true-value="YES" ng-false-value="NO">
      I can be disabled! My value is: {{disably}}
    </div>
  </file>
</example>
 */
jqmModule.directive('jqmCheckbox', [function () {
    return {
        restrict: 'A',
        transclude: true,
        replace: true,
        templateUrl: 'templates/jqmCheckbox.html',
        scope: {
            disabled: '@',
            mini: '@',
            iconpos: '@'
        },
        require: ['?ngModel','^?jqmControlgroup'],
        link: function (scope, element, attr, ctrls) {
            var ngModelCtrl = ctrls[0],
                jqmControlGroupCtrl = ctrls[1];
            scope.toggleChecked = toggleChecked;
            scope.isMini = isMini;
            scope.getIconPos = getIconPos;
            scope.isActive = isActive;

            if (ngModelCtrl) {
                enableNgModelCollaboration();
            }

            function isMini() {
                return scope.mini || (jqmControlGroupCtrl && jqmControlGroupCtrl.$scope.mini);
            }

            function getIconPos() {
                return scope.iconpos || (jqmControlGroupCtrl && jqmControlGroupCtrl.$scope.iconpos);
            }

            function isActive() {
                return (jqmControlGroupCtrl && jqmControlGroupCtrl.$scope.type === "horizontal") && scope.checked;
            }

            function toggleChecked() {
                if (scope.disabled) {
                    return;
                }
                scope.checked = !scope.checked;
                if (ngModelCtrl) {
                    ngModelCtrl.$setViewValue(scope.checked);
                }
            }

            function enableNgModelCollaboration() {
                // For the following code, see checkboxInputType in angular's sources
                var trueValue = attr.ngTrueValue,
                    falseValue = attr.ngFalseValue;

                if (!angular.isString(trueValue)) {
                    trueValue = true;
                }
                if (!angular.isString(falseValue)) {
                    falseValue = false;
                }

                ngModelCtrl.$render = function () {
                    scope.checked = ngModelCtrl.$viewValue;
                };

                ngModelCtrl.$formatters.push(function (value) {
                    return value === trueValue;
                });

                ngModelCtrl.$parsers.push(function (value) {
                    return value ? trueValue : falseValue;
                });
            }

        }
    };
}]);

jqmModule.directive('jqmClass', [function() {
    return function(scope, element, attr) {
        var oldVal;

        scope.$watch(attr.jqmClass, jqmClassWatchAction, true);

        attr.$observe('class', function(value) {
            var jqmClass = scope.$eval(attr.jqmClass);
            jqmClassWatchAction(jqmClass);
        });

        function jqmClassWatchAction(newVal) {
            if (oldVal && !angular.equals(newVal,oldVal)) {
                changeClass('removeClass', oldVal);
            }
            changeClass('addClass', newVal);
            oldVal = angular.copy(newVal);
        }

        function changeClass(fn, classVal) {
            if (angular.isObject(classVal) && !angular.isArray(classVal)) {
                var classes = [];
                angular.forEach(classVal, function(v, k) {
                    if (v) { classes.push(k); }
                });
                classVal = classes;
            }
            element[fn](angular.isArray(classVal) ? classVal.join(' ') : classVal);
        }
    };
}]);

jqmModule.directive('jqmControlgroup', function() {
    return {
        restrict: 'A',
        replace: true,
        transclude: true,
        templateUrl: 'templates/jqmControlgroup.html',
        scope: {
            mini: '@',
            iconpos: '@',
            type: '@',
            shadow: '@',
            corners: '@',
            legend: '@'
        },
        controller: ['$scope', JqmControlGroupCtrl]
    };

    function JqmControlGroupCtrl($scope) {
        this.$scope = $scope;
    }
});
/**
 * @ngdoc directive
 * @name jqm.directive:jqmFlip
 * @restrict A
 *
 * @description
 * Creates a jquery mobile flip switch on the given element.
 *
 * Anything inside the `jqm-flip` tag will be a label.
 *
 * Labels for the on and off state can be omitted.
 * If no values for the on and off state are specified on will be bound to true and off to false.
 *
 * A theme can be set with the jqm-theme directive and specific styles can be set with the ng-style parameter.
 * This is necessary to extend the width of the flip for long labels.
 *
 * @param {expression=} ngModel Assignable angular expression to data-bind to.
 * @param {string=} disabled Whether this flip switch is disabled.
 * @param {string=} mini Whether this flip should be displayed minified.
 * @param {string=} ngOnLabel The label which should be shown when fliped on (optional).
 * @param {string=} ngOnValue The value to which the expression should be set when fliped on (optional, default: true).
 * @param {string=} ngOffLabel The label which should be shown when fliped off (optional).
 * @param {string=} ngOffValue The value to which the expression should be set when fliped off (optional, default:false).
 *
 * @example
<example module="jqm">
  <file name="index.html">
   <p>Selected value is: {{flip}}</p>
   <div jqm-flip ng-model="flip">
     Default values true/false
   </div>
   <div jqm-flip ng-model="flip" jqm-theme="e">
     With theme
   </div>
   <div jqm-flip ng-model="flip2" on-label="On" on-value="On" off-label="Off" off-value="Off">
     My value is {{flip2}}
   </div>
  </file>
</example>
 */
jqmModule.directive('jqmFlip', [function () {
    return {
        restrict: 'A',
        transclude: true,
        replace: true,
        templateUrl: 'templates/jqmFlip.html',
        scope: {
            onLabel: '@',
            onValue: '@',
            offLabel: '@',
            offValue: '@',
            mini: '@',
            disabled: '@'
        },
        require: ['?ngModel', '^?jqmControlgroup'],
        link: function (scope, element, attr, ctrls) {
            var ngModelCtrl = ctrls[0];
            var jqmControlGroupCtrl = ctrls[1];
            var parsedOn;
            var parsedOff;

            scope.theme = scope.$theme || 'c';
            scope.isMini = isMini;
            scope.onValue = angular.isDefined(attr.onValue) ? scope.onValue : true;
            scope.offValue = angular.isDefined(attr.offValue) ? scope.offValue : false;

            initToggleState();
            bindClick();

            function initToggleState () {
                ngModelCtrl.$parsers.push(parseBoolean);
                parsedOn = parseBoolean(scope.onValue);
                parsedOff = parseBoolean(scope.offValue);
                ngModelCtrl.$render = updateToggleStyle;
                ngModelCtrl.$viewChangeListeners.push(updateToggleStyle);
            }

            function updateToggleStyle () {
                updateNaNAsOffValue();
                var toggled = isToggled();
                scope.toggleLabel = toggled ? scope.onLabel : scope.offLabel;
                scope.onStyle = toggled ? 100 : 0;
                scope.offStyle = toggled ? 0 : 100;
            }

            // this has to be done in the change listener,
            // otherwise the potential scope value would be overwritten with the off value
            function updateNaNAsOffValue () {
                if (!ngModelCtrl.$viewValue) {
                    ngModelCtrl.$setViewValue(parsedOff);
                }
            }

            function bindClick () {
                scope.toggle = function () {
                    ngModelCtrl.$setViewValue(isToggled() ? parsedOff : parsedOn);
                };
            }

            function isToggled () {
                return ngModelCtrl.$viewValue === parsedOn;
            }

            function isMini() {
                return scope.mini || (jqmControlGroupCtrl && jqmControlGroupCtrl.$scope.mini);
            }

            function parseBoolean(value) {
                if (value === 'true') {
                    return true;
                } else if (value === 'false') {
                    return false;
                }
                return value;
            }
        }
    };
}]);

/**
 * @ngdoc directive
 * @name jqm.directive:jqmFooter
 * @restrict A
 *
 * @description
 * Defines the footer of a `jqm-page`. For a persistent footer, put the footer directly below `jqmView` / `jqmCachingView`.
 *
 * @example
 <example module="jqm">
 <file name="index.html">
 <div jqm-page class="jqm-standalone-page" style="height: 100px;">
   Hello world!
   <div jqm-footer>
     <h1>Footer of Page1</h1>
   </div>
 </div>
 </file>
 </example>
 */
jqmModule.directive('jqmFooter', function () {
    return {
        restrict: 'A',
        // Own scope as we have a different default theme
        // than the page.
        scope: true,
        controller: angular.noop,
        link: function (scope, element, attr) {
            element.parent().data('jqmFooter', element);
            var hasExplicitTheme = scope.hasOwnProperty('$theme');
            if (!hasExplicitTheme) {
                scope.$theme = 'a';
            }
            element.addClass("ui-footer ui-bar-"+scope.$theme);
        }
    };
});

/**
 * @ngdoc directive
 * @name jqm.directive:jqmHeader
 * @restrict A
 *
 * @description
 * Defines the header of a `jqm-page`. For a persistent header, put the header directly below `jqmView` / `jqmCachingView`.
 *
 * @example
 <example module="jqm">
 <file name="index.html">
 <div jqm-page class="jqm-standalone-page" style="height: 100px;">
   <div jqm-header>
     <h1>Header of Page1</h1>
   </div>
   Hello world!
 </div>
 </file>
 </example>
 */
jqmModule.directive('jqmHeader', ['jqmConfig', function (jqmConfig) {
    return {
        restrict: 'A',
        // Own scope as we have a different default theme
        // than the page.
        scope: true,
        controller: angular.noop,
        link: function (scope, element, attr) {
            element.parent().data("jqmHeader", element);
            var hasExplicitTheme = scope.hasOwnProperty('$theme');
            if (!hasExplicitTheme) {
                scope.$theme = jqmConfig.secondaryTheme;
            }
            element.addClass("ui-header ui-bar-"+scope.$theme);
        }
    };
}]);

angular.forEach(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7'], function (headerName) {
    jqmModule.directive(headerName, hxDirective);
});
function hxDirective() {
    return {
        restrict: 'E',
        require: ['?^jqmHeader', '?^jqmFooter'],
        compile: function () {
            return function (scope, element, attrs, ctrls) {
                var i;
                for (i=0; i<ctrls.length; i++) {
                    if (ctrls[i]) {
                        element.addClass("ui-title");
                        break;
                    }
                }
            };
        }
    };
}


jqmModule.directive({
    jqmLiEntry: jqmLiEntryDirective(false),
    jqmLiDivider: jqmLiEntryDirective(true)
});
function jqmLiEntryDirective(isDivider) {
    return function() {
        return {
            restrict: 'A',
            replace: true,
            transclude: true,
            scope: {},
            templateUrl: 'templates/jqmLiEntry.html',
            link: function(scope) {
                if (isDivider) {
                    scope.divider = true;
                }
            }
        };
    };
}

jqmModule.directive('jqmLiLink', [function() {
    var isdef = angular.isDefined;
    return {
        restrict: 'A',
        transclude: true,
        replace: true,
        templateUrl: 'templates/jqmLiLink.html',
        controller: ['$scope', JqmLiController],
        scope: {
            icon: '@',
            iconpos: '@',
            iconShadow: '@',
            hasThumb: '@',
            hasCount: '@',
            link: '@jqmLiLink'
        },
        compile: function(element, attr) {
            attr.icon = isdef(attr.icon) ? attr.icon : 'ui-icon-arrow-r';
            attr.iconpos = isdef(attr.iconpos) ? attr.iconpos : 'right';
            attr.iconShadow = isdef(attr.iconShadow) ? attr.iconShadow : true;
        }
    };
    function JqmLiController($scope) {
    }
}]);


jqmModule.directive('jqmListview', [function() {
    var isdef = angular.isDefined;
    return {
        restrict: 'A',
        replace: true,
        transclude: true,
        templateUrl: 'templates/jqmListview.html',
        scope: {
            inset: '@'
        },
        link: function(scope, element, attr) {
            //We do this instead of '@' binding because "false" is actually truthy
            //And these default to true
            scope.shadow = isdef(attr.shadow) ? (attr.shadow==='true') : true;
            scope.corners = isdef(attr.corners) ? (attr.corners==='true') : true;
        }
    };
}]);

/**
 * @ngdoc directive
 * @name jqm.directive:jqmOnceClass
 * @restrict A
 *
 * @description
 * Sets the given class string once, with no watching.
 *
 * @example
 <example module="jqm">
 <file name="index.html">
   <div ng-init="someClass='a'" jqm-once-class="{{someClass}}">
       <input type="text" ng-model="someClass">
   </div>
 </file>
 </example>
 */
jqmModule.directive('jqmOnceClass', ['$interpolate', function($interpolate) {
    return {
        compile: function(element, iAttr) {
            //We have to catch the attr value before angular tries to compile it
            var classAttr = $interpolate(iAttr.jqmOnceClass);
            if (classAttr) {
                return function postLink(scope, element, attr) {
                    element.addClass( classAttr(scope) );
                };
            }
        }
    };
}]);

/**
 * @ngdoc directive
 * @name jqm.directive:jqmPage
 * @restrict A
 *
 * @description
 * Creates a jquery mobile page. Also adds automatic overflow scrolling for it's content.
 *
 * @example
 <example module="jqm">
 <file name="index.html">
 <div jqm-page class="jqm-standalone-page" style="height: 100px;">
 <p>Hello world!</p>
 <p>New Line</p>
 <p>New Line</p>
 <p>New Line</p>
 <p>New Line</p>
 <p>New Line</p>
 <p>New Line</p>
 <p>New Line</p>
 <p>New Line</p>
 <p>New Line</p>
 <p>New Line</p>
 </div>
 </file>
 </example>
 */
jqmModule.directive('jqmPage', ['jqmScrollableDirective', '$rootScope', function (jqmScrollableDirectives, $rootScope) {
    return {
        restrict: 'A',
        require: 'jqmPage',
        controller: angular.noop,
        // Note: We are not using a template here by purpose,
        // so that other directives like dialog may reuse this directive in a template themselves.
        compile: function (cElement, cAttr) {
            var content = angular.element('<div class="ui-content"></div>');
            content.append(cElement.contents());
            cElement.append(content);
            cElement.addClass("ui-page");
            return function (scope, lElement, lAttr, jqmPageCtrl) {
                var content = lElement.children();
                lElement.addClass("ui-body-" + scope.$theme);
                addAndRemoveParentDependingClasses(scope, lElement, content);
                if (content.data("jqmHeader")) {
                    content.addClass('jqm-content-with-header');
                    lElement.prepend(content.data("jqmHeader"));
                }
                if (content.data("jqmFooter")) {
                    content.addClass('jqm-content-with-footer');
                    lElement.append(content.data("jqmFooter"));
                }
                // Don't use scrolly-scroll directive here by purpose,
                // as it is swallowing all mousemove events, which prevents
                // the address bar to be shown using a scroll on the page header.
                angular.forEach(jqmScrollableDirectives, function (jqmScrollableDirective) {
                    jqmScrollableDirective.link(scope, content, lAttr);
                });
            };

            function addAndRemoveParentDependingClasses(scope, lElement, content) {
                var viewContentLoadedOff = $rootScope.$on('$viewContentLoaded', function (event, pageNodes) {
                    // Note: pageNodes may contain text nodes as well as our page.
                    var pageEl;
                    angular.forEach(pageNodes, function (pageNode) {
                        if (pageNode === lElement[0]) {
                            pageEl = pageNode;
                        }
                    });
                    // Note: checking event.targetScope===scope does not work when we put a jqm-theme on the page.
                    if (pageEl) {
                        lElement.parent().addClass("ui-overlay-" + scope.$theme);
                        if (lElement.parent().data("jqmHeader")) {
                            content.addClass("jqm-content-with-header");
                        }
                        if (lElement.parent().data("jqmFooter")) {
                            content.addClass("jqm-content-with-footer");
                        }
                        lElement.parent().addClass("ui-mobile-viewport");
                    }
                });
                scope.$on('$destroy', viewContentLoadedOff);
            }
        }
    };
}]);
/**
 * @ngdoc directive
 * @name jqm.directive:jqmPanel
 * @restrict A
 *
 * @description
 * Creates a jquery mobile panel.  Must be placed inside of a jqm-panel-container.
 *
 * @param {expression=} opened Assignable angular expression to data-bind the panel's open state to.
 * @param {string=} display Default 'reveal'.  What display type the panel has. Available: 'reveal', 'overlay', 'push'.
 * @param {string=} position Default 'left'. What position the panel is in. Available: 'left', 'right'.
 *
 * @require jqmPanelContainer.
 */
jqmModule.directive('jqmPanel', function() {
    var isDef = angular.isDefined;
    return {
        restrict: 'A',
        require: '^jqmPanelContainer',
        replace: true,
        transclude: true,
        templateUrl: 'templates/jqmPanel.html',
        // marker controller.
        controller: angular.noop,
        scope: {
            display: '@',
            position: '@'
        },
        compile: function(element, attr) {
            attr.display = isDef(attr.display) ? attr.display : 'reveal';
            attr.position = isDef(attr.position) ? attr.position : 'left';

            return function(scope, element, attr, jqmPanelContainerCtrl) {
                if (scope.position !== 'left' && scope.position !== 'right') {
                    throw new Error("jqm-panel position is invalid. Expected 'left' or 'right', got '"+scope.position+"'");
                }
                jqmPanelContainerCtrl.addPanel({
                    scope: scope,
                    element: element
                });
            };
        }
    };
});

/**
 * @ngdoc directive
 * @name jqm.directive:jqmPanelContainer
 * @restrict A
 *
 * @description
 * A container for jquery mobile panels.
 *
 * If you wish to use this with a view, you want the jqm-panel-container as the
 * parent of your view and your panels. For example:
 * <pre>
 * <div jqm-panel-container="myPanel">
 *   <div jqm-panel>My Panel!</div>
 *   <div jqm-view></div>
 * </div>
 * </pre>
 *
 * @param {expression=} jqmPanelContainer Assignable angular expression to data-bind the panel's open state to.
 *                      This is either `left` (show left panel), `right` (show right panel) or null.
 *
 * @example
<example module="jqm">
  <file name="index.html">
     <div ng-init="state={}"></div>
     <div jqm-panel-container="state.openPanel" style="height:300px;overflow:hidden">
        <div jqm-panel position="left">
          Hello, left panel!
        </div>
        <div jqm-panel position="right" display="overlay">
         Hello, right panel!
        </div>
        <div style="background: white">
           Opened panel: {{state.openPanel}}
           <button ng-click="state.openPanel='left'">Open left</button>
           <button ng-click="state.openPanel='right'">Open right</button>
        </div>
     </div>
  </file>
</example>
 */

 jqmModule.directive('jqmPanelContainer', function () {
    return {
        restrict: 'A',
        scope: {
            openPanelName: '=jqmPanelContainer'
        },
        transclude: true,
        templateUrl: 'templates/jqmPanelContainer.html',
        replace: true
    };
});
// Separate directive for the controller as we can't inject a controller from a directive with templateUrl
// into children!
jqmModule.directive('jqmPanelContainer', ['$timeout', '$transitionComplete', '$sniffer', function ($timeout, $transitionComplete, $sniffer) {
    return {
        restrict: 'A',
        controller: ['$scope', '$element', JqmPanelContainerCtrl],
        link: function(scope, element, attr, jqmPanelContainerCtrl) {
            jqmPanelContainerCtrl.setContent(findPanelContent());

            function findPanelContent() {
                var content = angular.element();
                angular.forEach(element.children(), function(element) {
                    var el = angular.element(element);
                    // ignore panels and the generated ui-panel-dismiss div.
                    if (!el.data('$jqmPanelController') && el.data('$scope') && el.scope().$$transcluded) {
                        content.push(element);
                    }
                });
                return content;
            }
        }
    };
    function JqmPanelContainerCtrl($scope, $element) {
        var panels = {},
            content;

        this.addPanel = function (panel) {
            panels[panel.scope.position] = panel;
        };
        this.setContent = function(_content) {
            content = _content;
        };
        $scope.$watch('$scopeAs.pc.openPanelName', openPanelChanged);
        if (!$sniffer.animations) {
            $scope.$watch('$scopeAs.pc.openPanelName', transitionComplete);
        } else {
            $transitionComplete($element, transitionComplete);
        }

        function openPanelChanged() {
            updatePanelContent();
            angular.forEach(panels, function (panel) {
                var opened = panel.scope.position === $scope.openPanelName;
                if (opened) {
                    panel.element.removeClass('ui-panel-closed');
                    $timeout(function () {
                        panel.element.addClass('ui-panel-open');
                    }, 1, false);
                } else {
                    panel.element.removeClass('ui-panel-open ui-panel-opened');
                }
            });

        }

        //Doing transition stuff in jqmPanelContainer, as
        //we need to listen for transition complete event on either the panel
        //element or the panel content wrapper element. Some panel display
        //types (overlay) only animate the panel, and some (reveal) only
        //animate the content wrapper.
        function transitionComplete() {
            angular.forEach(panels, function (panel) {
                var opened = panel.scope.position === $scope.openPanelName;
                if (opened) {
                    panel.element.addClass('ui-panel-opened');
                } else {
                    panel.element.addClass('ui-panel-closed');
                }
            });
        }

        function updatePanelContent() {
            if (!content) {
                return;
            }
            var openPanel = panels[$scope.openPanelName],
                openPanelScope = openPanel && openPanel.scope;

            content.addClass('ui-panel-content-wrap ui-panel-animate');

            content.toggleClass('ui-panel-content-wrap-open', !!openPanelScope);

            content.toggleClass('ui-panel-content-wrap-position-left',
                !!(openPanelScope && openPanelScope.position === 'left'));

            content.toggleClass('ui-panel-content-wrap-position-right',
                !!(openPanelScope && openPanelScope.position === 'right'));
            content.toggleClass('ui-panel-content-wrap-display-reveal',
                !!(openPanelScope && openPanelScope.display === 'reveal'));
            content.toggleClass('ui-panel-content-wrap-display-push',
                !!(openPanelScope && openPanelScope.display === 'push'));
            content.toggleClass('ui-panel-content-wrap-display-overlay',
                !!(openPanelScope && openPanelScope.display === 'overlay'));
        }
    }
}]);

/**
 * @ngdoc directive
 * @name jqm.directive:jqmPositionAnchor
 * @restrict A
 *
 * @description
 * For every child element that has an own scope this will set the property $position in the child's scope
 * and keep that value updated whenever elements are added, moved or removed from the element.
 *
 * @example
 <example module="jqm">
 <file name="index.html">
 <div jqm-position-anchor>
     <div ng-controller="angular.noop">First child: {{$position}}</div>
     <div ng-controller="angular.noop">Middle child: {{$position}}</div>
     <div ng-controller="angular.noop">Last child: {{$position}}</div>
 </div>
 </file>
 </example>
 */
jqmModule.directive('jqmPositionAnchor', [ '$rootScope', function ($rootScope) {
    return {
        restrict: 'A',
        link: function (scope, element) {
            var elementNode = element[0];
            afterFn(elementNode, 'appendChild', enqueueUpdate);
            afterFn(elementNode, 'insertBefore', enqueueUpdate);
            afterFn(elementNode, 'removeChild', enqueueUpdate);

            enqueueUpdate();

            function afterFn(context, fnName, afterCb) {
                var fn = context[fnName];
                context[fnName] = function (arg1, arg2) {
                    fn.call(context, arg1, arg2);
                    afterCb(arg1, arg2);
                };
            }

            function enqueueUpdate() {
                if (!enqueueUpdate.started) {
                    enqueueUpdate.started = true;
                    $rootScope.$evalAsync(function () {
                        updateChildren();
                        enqueueUpdate.started = false;
                    });
                }
            }

            function updateChildren() {
                var children = element.children(),
                    length = children.length,
                    i, child, newPos, childScope;
                for (i = 0; i < length; i++) {
                    child = children.eq(i);
                    childScope = child.scope();
                    if (childScope !== scope) {
                        childScope.$position = getPosition(i, length);
                    }
                }
            }

            function getPosition(index, length) {
                return {
                    first: index === 0,
                    last: index === length - 1,
                    middle: index > 0 && index < length - 1
                };
            }

        }
    };
}]);
jqmModule.directive('jqmScopeAs', [function () {
    return {
        restrict: 'A',
        compile: function (element, attrs) {
            var scopeAs = attrs.jqmScopeAs;
            return {
                pre: function (scope) {
                    scope.$$scopeAs = scopeAs;
                }
            };
        }
    };
}]);

/**
 * @ngdoc directive
 * @name jqm.directive:jqmScrollable
 * @restrict ECA
 *
 * @description
 * # Overview
 * `jqmScrollable` enables fake scrolling for the given element using angular-scrolly.
 * @example
    <example module="jqm">
      <file name="index.html">
         <div style="height:100px;overflow:hidden" jqm-scrollable>
             <p>Hello</p>
             <p>Hello</p>
             <p>Hello</p>
             <p>Hello</p>
             <p>Hello</p>
             <p>Hello</p>
             <p>Hello</p>
             <p>Hello</p>
             <p>Hello</p>
             <p>Hello</p>
             <p>Hello</p>
             <p>Hello</p>
         </div>
      </file>
    </example>
*/
// Don't use scrolly-scroll directive here by purpose,
// as it is swallowing all mousemove events, which prevents
// the address bar to be shown using a scroll on the page header.
jqmModule.directive('jqmScrollable', ['$scroller', function($scroller) {
    return {
        restrict: 'A',
        link: function(scope, element) {
            $scroller(element);
        }
    };
}]);
/**
 * @ngdoc directive
 * @name jqm.directive:jqmTextarea
 * @restrict A
 *
 * @description
 * Creates an jquery mobile textarea on the given elemen.
 *
 * @param {string} ngModel Assignable angular expression to data-bind to.
 * @param {string=} disabled Whether this input is disabled.
 *
 * @example
 <example module="jqm">
 <file name="index.html">
 Textarea with ng-model:
 <div ng-model="model" jqm-textarea></div>

 Value: {{model}}
 <p/>
 Textarea disabled:
 <div data-disabled="disabled" jqm-textarea>Hello World</div>
 <p/>
 </file>
 </example>
 */
jqmModule.directive('jqmTextarea', ['textareaDirective', function (textareaDirective) {
    return {
        templateUrl: 'templates/jqmTextarea.html',
        replace: true,
        restrict: 'A',
        require: '?ngModel',
        scope: {
            disabled: '@'
        },
        link: function (scope, element, attr, ngModelCtrl) {
            var textarea = angular.element(element[0]);

            linkInput();

            function linkInput() {
                textarea.bind('focus', function () {
                    element.addClass('ui-focus');
                });
                textarea.bind('blur', function () {
                    element.removeClass('ui-focus');
                });

                angular.forEach(textareaDirective, function (directive) {
                    directive.link(scope, textarea, attr, ngModelCtrl);
                });
                return textarea;
            }
        }
    };
}]);
/**
 * @ngdoc directive
 * @name jqm.directive:jqmTextinput
 * @restrict A
 *
 * @description
 * Creates an jquery mobile input on the given element.
 *
 * @param {string} ngModel Assignable angular expression to data-bind to.
 * @param {string=} type Defines the type attribute for the resulting input. Default is 'text'.
 * @param {string=} disabled Whether this input is disabled.
 * @param {string=} mini Whether this input is mini.
 * @param {boolean=} clearBtn Whether this input should show a clear button to clear the input.
 * @param {string=} clearBtnText Defines the tooltip text for the clear Button. Default is 'clear text'.
 * @param {string=} placeholder Defines the placholder value for the input Element.
 *
 * @example
 <example module="jqm">
 <file name="index.html">
 Text Input:
 <div jqm-textinput ng-model="value"></div>
 <p/>
 Text Input: clear-btn="true"
 <div jqm-textinput ng-model="value" clear-btn="true"></div>
 <hl/>
 Search Input:
 <div jqm-textinput ng-model="search" type="search"></div>
 </file>
 </example>
 */
jqmModule.directive('jqmTextinput', ['inputDirective', function (inputDirective) {
    return {
        templateUrl: 'templates/jqmTextinput.html',
        replace: true,
        restrict: 'A',
        require: '?ngModel',
        scope: {
            clearBtn: '@',
            type: '@',
            clearBtnText: '@',
            disabled: '@',
            mini: '@',
            placeholder: '@'
        },
        link: function (scope, element, attr, ngModelCtrl) {
            var input = angular.element(element[0].getElementsByTagName("input"));

            scope.typeValue = type();
            scope.clearBtnTextValue = scope.clearBtnText || 'clear text';

            linkInput();
            scope.getValue = getValue;
            scope.clearValue = clearValue;
            scope.isSearch = isSearch;

            function type() {
                var inputType = scope.type || 'text';
                return (inputType === 'search') ? 'text' : inputType;
            }

            function getValue() {
                return scope.type === 'color' || (ngModelCtrl && ngModelCtrl.$viewValue);
            }

            function clearValue(event) {
                event.preventDefault();


                input[0].value = '';
                if (ngModelCtrl) {
                    ngModelCtrl.$setViewValue('');
                }
            }

            function isSearch() {
                return scope.type === 'search';
            }

            function linkInput() {
                input.bind('focus', function () {
                    element.addClass('ui-focus');
                });
                input.bind('blur', function () {
                    element.removeClass('ui-focus');
                });

                angular.forEach(inputDirective, function (directive) {
                    directive.link(scope, input, attr, ngModelCtrl);
                });
                return input;
            }
        }
    };
}]);
/**
 * @ngdoc directive
 * @name jqm.directive:jqmTheme
 * @restrict A
 *
 * @description
 * Sets the jqm theme for this element and it's children by adding a `$theme` property to the scope.
 * Other directives like `jqmCheckbox` evaluate that property.
 *
 * @example
 <example module="jqm">
 <file name="index.html">
 <div>
   <div jqm-checkbox jqm-theme="a">Theme a</div>
   <div jqm-checkbox jqm-theme="b">Theme b</div>
 </div>
 </file>
 </example>
 */
jqmModule.directive('jqmTheme', [function () {
    return {
        restrict: 'A',
        // Need an own scope so we can distinguish between the parent and the child scope!
        scope: true,
        compile: function compile() {
            return {
                pre: function preLink(scope, iElement, iAttrs) {
                    // Set the theme before all other link functions of children
                    var theme = iAttrs.jqmTheme;
                    if (theme) {
                        scope.$theme = theme;
                    }
                }
            };
        }
    };
}]);

/**
 * @ngdoc directive
 * @name jqm.directive:jqmView
 * @restrict ECA
 *
 * @description
 * # Overview
 * `jqmView` extends `ngView` in the following way:
 *
 * - animations can also be specified on routes using the `animation` property (see below).
 * - animations can also be specified in the template using the `view-animation` attribute on a root element.
 * - when the user hits the back button, the last animation is executed with the `-reverse` suffix.
 * - instead of using `$route` an expression can be specified as value of the directive. Whenever
 *   the value of this expression changes `jqmView` updates accordingly.
 * - content that has been declared inside of `ngView` stays there, so you can mix dynamically loaded content with
 *   fixed content.
 *
 * @param {expression=} jqmView angular expression evaluating to a route.
 *
 *   * `{string}`: This will be interpreted as the url of a template.
 *   * `{object}`: A route object with the same properties as `$route.current`:
 *     - `templateUrl` - `{string=}` - the url for the template
 *     - `controller` - `{string=|function()=}` - the controller
 *     - `controllerAs` - `{string=}` - the name of the controller in the scope
 *     - `locals` - `{object=}` - locals to be used when instantiating the controller
 *     - `back` - `{boolean=}` - whether the animation should be executed in reverse
 *     - `animation` - `{string=|function()=}` - the animation to use. If `animation` is a function it will
 *        be called using the `$injector` with the extra locals `$routeParams` (`route.params`) and `$scope` (the scope of `jqm-view`).
 *
 * @scope
 * @example
 <example module="jqmView">
 <file name="index.html">
 Choose:
 <a href="#/Book/Moby">Moby</a> |
 <a href="#/Book/Moby/ch/1">Moby: Ch1</a> |
 <a href="#/Book/Gatsby">Gatsby</a> |
 <a href="#/Book/Gatsby/ch/4?key=value">Gatsby: Ch4</a> |
 <a href="#/Book/Scarlet">Scarlet Letter</a><br/>

 <div jqm-view style="height:300px"></div>
 </file>

 <file name="book.html">
 <div jqm-page>
 <div jqm-header><h1>Book {{book.params.bookId}}</h1></div>
 The book contains ...
 </div>
 </file>

 <file name="chapter.html">
 <div jqm-page>
 <div jqm-header><h1>Chapter {{chapter.params.chapterId}} of {{chapter.params.bookId}}</h1></div>
 This chapter contains ...
 </div>
 </file>

 <file name="script.js">
 angular.module('jqmView', ['jqm'], function($routeProvider) {
          $routeProvider.when('/Book/:bookId', {
            templateUrl: 'book.html',
            controller: BookCntl,
            controllerAs: 'book',
            animation: 'page-slide'
          });
          $routeProvider.when('/Book/:bookId/ch/:chapterId', {
            templateUrl: 'chapter.html',
            controller: ChapterCntl,
            controllerAs: 'chapter',
            animation: 'page-slide'
          });
        });

 function BookCntl($routeParams) {
          this.params = $routeParams;
        }

 function ChapterCntl($routeParams) {
          this.params = $routeParams;
        }
 </file>
 </example>
 */
jqmModule.directive('jqmView', ['$templateCache', '$route', '$anchorScroll', '$compile',
    '$controller', '$animator', '$http', '$q', '$injector',
    function ($templateCache, $route, $anchorScroll, $compile, $controller, $animator, $http, $q, $injector) {
        return {
            restrict: 'ECA',
            controller: ['$scope', JqmViewCtrl],
            require: 'jqmView',
            compile: function (element, attr) {
                element.children().attr('view-fixed', 'true');
                return link;
            }
        };
        function link(scope, element, attr, jqmViewCtrl) {
            var lastScope,
                lastContents,
                lastAnimationName,
                onloadExp = attr.onload || '',
                animateAttr = {},
                animate = $animator(scope, animateAttr),
                jqmViewExpr = attr[jqmViewCtrl.watchAttrName],
                changeCounter = 0;
            if (!jqmViewExpr) {
                watchRoute();
            } else {
                watchRouteExp(jqmViewExpr);
            }

            function watchRoute() {
                scope.$on('$routeChangeSuccess', update);
                update();

                function update() {
                    routeChanged($route.current);
                }
            }


            function watchRouteExp(routeExp) {
                // only shallow watch (e.g. change of route instance)
                scope.$watch(routeExp, routeChanged, false);
            }

            function routeChanged(route) {
                // For this counter logic, see ngIncludeDirective!
                var thisChangeId = ++changeCounter,
                    $template;
                if (!route || angular.isString(route)) {
                    route = {
                        templateUrl: route
                    };
                }
                $template = route.locals && route.locals.$template;
                var url = route.loadedTemplateUrl || route.templateUrl || $template;
                if (url) {
                    // Note: $route already loads the template. However, as it's also
                    // using $templateCache and so does loadAndCompile we don't get extra $http requests.
                    jqmViewCtrl.loadAndCompile(url, $template).then(function (templateInstance) {
                        if (thisChangeId !== changeCounter) {
                            return;
                        }
                        templateLoaded(route, templateInstance);
                    }, function () {
                        if (thisChangeId === changeCounter) {
                            clearContent();
                        }
                        clearContent();
                    });
                } else {
                    clearContent();
                }
            }

            function clearContent() {
                var contents = angular.element();
                angular.forEach(element.contents(), function(element) {
                    var el = angular.element(element);
                    if (!el.attr('view-fixed')) {
                        contents.push(element);
                    }
                });

                jqmViewCtrl.onClearContent(contents);
                animate.leave(contents, element);
                if (lastScope) {
                    lastScope.$destroy();
                    lastScope = null;
                }
            }

            function templateLoaded(route, templateInstance) {
                var locals = route.locals || {},
                    controller;
                calcAnimation(route, templateInstance);
                clearContent();
                animate.enter(templateInstance.elements, element);

                lastScope = locals.$scope = templateInstance.scope;
                route.scope = lastScope;
                lastContents = templateInstance.elements;

                if (route.controller) {
                    controller = $controller(route.controller, locals);
                    if (route.controllerAs) {
                        lastScope[route.controllerAs] = controller;
                    }
                    element.children().data('$ngControllerController', controller);
                }
                lastScope.$emit('$viewContentLoaded', templateInstance.elements);
                lastScope.$eval(onloadExp);
                // $anchorScroll might listen on event...
                $anchorScroll();
            }

            function calcAnimation(route, templateInstance) {
                var animation,
                    reverse = route.back,
                    routeAnimationName,
                    animationName;
                if (attr.ngAnimate) {
                    animateAttr.ngAnimate = attr.ngAnimate;
                    return;
                }
                animation = route.animation;
                if (angular.isFunction(animation) || angular.isArray(animation)) {
                    routeAnimationName = $injector.invoke(route.animation, null, {
                        $scope: scope,
                        $routeParams: route.params
                    });
                } else {
                    routeAnimationName = animation;
                }
                if (!routeAnimationName) {
                    angular.forEach(templateInstance.elements, function (element) {
                        var el = angular.element(element);
                        routeAnimationName = routeAnimationName || el.attr('view-animation') || el.attr('data-view-animation');
                    });
                }
                if (reverse) {
                    animationName = lastAnimationName;
                    if (animationName) {
                        animationName += "-reverse";
                    }
                } else {
                    animationName = routeAnimationName;
                }
                lastAnimationName = routeAnimationName;
                if (animationName) {
                    animateAttr.ngAnimate = "'" + animationName + "'";
                } else {
                    animateAttr.ngAnimate = "''";
                }
            }
        }

        function JqmViewCtrl($scope) {
            this.watchAttrName = 'jqmView';
            this.loadAndCompile = loadAndCompile;
            this.onClearContent = angular.noop;

            function loadAndCompile(templateUrl, template) {
                if (template) {
                    return $q.when(compile(template));
                } else {
                    return $http.get(templateUrl, {cache: $templateCache}).then(function (response) {
                        return compile(response.data);
                    });
                }
            }

            function compile(template) {
                var link = $compile(angular.element('<div></div>').html(template).contents());
                var scope = $scope.$new();
                return {
                    scope: scope,
                    elements: link(scope)
                };
            }
        }
    }]);

// set the initial `ui-btn-up-<theme>` class for buttons
jqmModule.directive('ngClick', [function () {
    return function (scope, element, attr) {
        if (element.hasClass('ui-btn') || element.hasClass('jqm-active-toggle')) {
            element.addClass("ui-btn-up-" + scope.$theme);
            element.data('$$jqmActiveToggle', true);
        }
    };
}]);

// set the `ui-btn-down-<theme>` class on buttons on mouse down / touchstart
jqmModule.run([function () {
    var jqLiteProto = angular.element.prototype;
    // Note that this may be called multiple times during tests!
    jqLiteProto._addClass = jqLiteProto._addClass || jqLiteProto.addClass;
    jqLiteProto._removeClass = jqLiteProto._removeClass || jqLiteProto.removeClass;
    jqLiteProto.addClass = function (className) {
        var theme;
        if (className === 'ng-click-active' && this.data('$$jqmActiveToggle')) {
            theme = this.scope().$theme;
            this._removeClass("ui-btn-up-" + theme);
            className += " ui-btn-down-" + theme;
        }
        return this._addClass(className);
    };
    jqLiteProto.removeClass = function (className) {
        var theme;
        if (className === 'ng-click-active' && this.data('$$jqmActiveToggle')) {
            theme = this.scope().$theme;
            this._addClass("ui-btn-up-" + theme);
            className += " ui-btn-down-" + theme;
        }
        return this._removeClass(className);
    };
}]);

/**
 * @ngdoc function
 * @name jqm.$anchorScroll
 * @requires $hideAddressBar
 *
 * @description
 * This overrides the default `$anchorScroll` of angular and calls `$hideAddressBar` instead.
 * By this, the address bar is hidden on every view change, orientation change, ...
 */
jqmModule.factory('$anchorScroll', ['$hideAddressBar', function ($hideAddressBar) {
    return deferredHideAddressBar;

    // We almost always want to allow the browser to settle after
    // showing a page, orientation change, ... before we hide the address bar.
    function deferredHideAddressBar() {
        window.setTimeout($hideAddressBar, 50);
    }
}]);
jqmModule.run(['$anchorScroll', '$rootScope', function($anchorScroll, $rootScope) {
    $rootScope.$on('$orientationChanged', function(event) {
        $anchorScroll();
    });
}]);
jqmModule.factory('$animationComplete', ['$sniffer', function ($sniffer) {
    return function (el, callback, once) {
        var eventNames = 'animationend';
        if (!$sniffer.animations) {
            throw new Error("Browser does not support css animations.");
        }
        if ($sniffer.vendorPrefix) {
            eventNames += " " + $sniffer.vendorPrefix.toLowerCase() + "AnimationEnd";
        }
        var _callback = callback;
        if (once) {
            callback = function() {
                unbind();
                _callback();
            };
        }
        //We have to split because unbind doesn't support multiple event names in one string
        //This will be fixed in 1.2, PR opened https://github.com/angular/angular.js/pull/3256
        angular.forEach(eventNames.split(' '), function(eventName) {
            el.bind(eventName, callback);
        });

        return unbind;

        function unbind() {
            angular.forEach(eventNames.split(' '), function(eventName) {
                el.unbind(eventName, callback);
            });
        }
    };
}]);

jqmModule.config(['$provide', function ($provide) {
    $provide.decorator('$browser', ['$delegate', browserHashReplaceDecorator]);
    return;

    // ---------------
    // implementation functions
    function browserHashReplaceDecorator($browser) {
        // On android and non html5mode, the hash in a location
        // is returned as %23.
        var _url = $browser.url;
        $browser.url = function () {
            var res = _url.apply(this, arguments);
            if (arguments.length === 0) {
                res = res.replace(/%23/g, '#');
                res = res.replace(/ /g, '%20');
            }
            return res;
        };
        return $browser;
    }
}]);
/**
 * @ngdoc function
 * @name jqm.$hideAddressBar
 * @requires $window
 * @requires $rootElement
 * @requires $orientation
 *
 * @description
 * When called, this will hide the address bar on mobile devices that support it.
 */
jqmModule.factory('$hideAddressBar', ['$window', '$rootElement', '$orientation', function ($window, $rootElement, $orientation) {
    var MIN_SCREEN_HEIGHT_WIDTH_OPT_OUT = 500,
        MAX_SCREEN_HEIGHT = 800,
        scrollToHideAddressBar,
        cachedHeights = {
        };
    if (!$window.addEventListener || addressBarHidingOptOut()) {
        return noop;
    } else {
        return hideAddressBar;
    }

    function noop(done) {
        if (done) {
            done();
        }
    }

    // -----------------
    function hideAddressBar(done) {
        var orientation = $orientation(),
            docHeight = cachedHeights[orientation];
        if (!docHeight) {
            // if we don't know the exact height of the document without the address bar,
            // start with one that is always higher than the screen to be
            // sure the address bar can be hidden.
            docHeight = MAX_SCREEN_HEIGHT;
        }
        setDocumentHeight(docHeight);
        if (!angular.isDefined(scrollToHideAddressBar)) {
            // iOS needs a scrollTo(0,0) and android a scrollTo(0,1).
            // We always do a scrollTo(0,1) at first and check the scroll position
            // afterwards for future scrolls.
            $window.scrollTo(0, 1);
        } else {
            $window.scrollTo(0, scrollToHideAddressBar);
        }
        // Wait for a scroll event or a timeout, whichever is first.
        $window.addEventListener('scroll', afterScrollOrTimeout, false);
        var timeoutHandle = $window.setTimeout(afterScrollOrTimeout, 400);

        function afterScrollOrTimeout() {
            $window.removeEventListener('scroll', afterScrollOrTimeout, false);
            $window.clearTimeout(timeoutHandle);
            if (!cachedHeights[orientation]) {
                cachedHeights[orientation] = getViewportHeight();
                setDocumentHeight(cachedHeights[orientation]);
            }
            if (!angular.isDefined(scrollToHideAddressBar)) {
                if ($window.pageYOffset === 1) {
                    // iOS
                    scrollToHideAddressBar = 0;
                    $window.scrollTo(0, 0);
                } else {
                    // Android
                    scrollToHideAddressBar = 1;
                }
            }
            if (done) {
                done();
            }
        }
    }

    function addressBarHidingOptOut() {
        return Math.max(getViewportHeight(), getViewportWidth()) > MIN_SCREEN_HEIGHT_WIDTH_OPT_OUT;
    }

    function getViewportWidth() {
        return $window.innerWidth;
    }

    function getViewportHeight() {
        return $window.innerHeight;
    }

    function setDocumentHeight(height) {
        $rootElement.css('height', height + 'px');
    }
}]);
jqmModule.config(['$provide', function($provide) {
    var lastLocationChangeByProgram = false;
    $provide.decorator('$location', ['$delegate', '$browser', '$history', '$rootScope', function($location, $browser, $history, $rootScope) {
        instrumentBrowser();

        $rootScope.$on('$locationChangeSuccess', function () {
            if (!lastLocationChangeByProgram) {
                $history.onUrlChangeBrowser($location.url());
            }
        });

        $history.onUrlChangeProgrammatically($location.url() || '/', false);

        return $location;

        function instrumentBrowser() {
            var _url = $browser.url;
            $browser.url = function (url, replace) {
                if (url) {
                    // setter
                    $history.onUrlChangeProgrammatically($location.url(), replace);
                    lastLocationChangeByProgram = true;
                    $rootScope.$evalAsync(function () {
                        lastLocationChangeByProgram = false;
                    });
                }
                return _url.apply(this, arguments);
            };
        }
    }]);
}]);

jqmModule.factory('$history', ['$window', '$timeout', function $historyFactory($window, $timeout) {
    var $history = {
        go: go,
        urlStack: [],
        indexOf: indexOf,
        activeIndex: -1,
        previousIndex: -1,
        onUrlChangeBrowser: onUrlChangeBrowser,
        onUrlChangeProgrammatically: onUrlChangeProgrammatically
    };

    return $history;

    function go(relativeIndex) {
        // Always execute history.go asynchronously.
        // This is required as firefox and IE10 trigger the popstate event
        // in sync. By using a setTimeout we have the same behaviour everywhere.
        // Don't use $defer here as we don't want to trigger another digest cycle.
        // Note that we need at least 20ms to ensure that
        // the hashchange/popstate event for the current page
        // as been delivered (in IE this can take some time...).
        $timeout(function () {
            $window.history.go(relativeIndex);
        }, 20, false);
    }

    function indexOf(url) {
        var i,
            urlStack = $history.urlStack;
        for (i = 0; i < urlStack.length; i++) {
            if (urlStack[i].url === url) {
                return i;
            }
        }
        return -1;
    }

    function onUrlChangeBrowser(url) {
        var oldIndex = $history.activeIndex;
        $history.activeIndex = indexOf(url);
        if ($history.activeIndex === -1) {
            onUrlChangeProgrammatically(url, false);
        } else {
            $history.previousIndex = oldIndex;
        }
    }

    function onUrlChangeProgrammatically(url, replace) {
        var currentEntry = $history.urlStack[$history.activeIndex];
        if (!currentEntry || currentEntry.url !== url) {
            $history.previousIndex = $history.activeIndex;
            if (!replace) {
                $history.activeIndex++;
            }
            $history.urlStack.splice($history.activeIndex, $history.urlStack.length - $history.activeIndex);
            $history.urlStack.push({url: url});
        }
    }
}]);

/**
 * @ngdoc object
 * @name jqm.jqmConfigProvider
 *
 * @description Used to configure the default theme.
 */

jqmModule.provider('jqmConfig', function() {
    /**
     * @ngdoc method
     * @name jqm.jqmConfigProvider#primaryTheme
     * @methodOf jqm.jqmConfigProvider
     *
     * @description Sets/gets the default primary theme (used if jqm-theme is
     * not set on the element). Default: 'c'
     *
     * @param {string=} newTheme The new primary theme to set.
     * @returns {string} The current primary theme.
     */
    /**
     * @ngdoc method
     * @name jqm.jqmConfigProvider#secondaryTheme
     * @methodOf jqm.jqmConfigProvider
     * 
     * @description Sets/gets the secondary theme (used on footers, headers, etc 
     * if not theme is set on the element). Default: 'a'
     *
     * @param {string=} newTheme The new secondary theme to set.
     * @returns {string} The current secondary theme.
     */

    var _primaryTheme = 'c';
    var _secondaryTheme = 'a';
    return {
        primaryTheme: primaryTheme,
        secondaryTheme: secondaryTheme,
        $get: serviceFactory
    };

    function primaryTheme(value) {
        if (value) { _primaryTheme = value; }
        return _primaryTheme;
    }
    function secondaryTheme(value) {
        if (value) { _secondaryTheme = value; }
        return _secondaryTheme;
    }

    /**
     * @ngdoc object
     * @name jqm.jqmConfig
     * @description
     * A service used to tell the default primary and secondary theme. 
     */
    /**
     * @ngdoc property
     * @name jqm.jqmConfig#primaryTheme
     * @propertyOf jqm.jqmConfig
     *
     * @description {string} The current primary theme.  See {@link jqm.jqmConfigProvider#primaryTheme}.
     */
    /**
     * @ngdoc property
     * @name jqm.jqmConfig#secondaryTheme
     * @propertyOf jqm.jqmConfig
     *
     * @description {string} The current secondary theme.  See {@link jqm.jqmConfigProvider#secondaryTheme}.
     */
    function serviceFactory() {
        return {
            primaryTheme: _primaryTheme,
            secondaryTheme: _secondaryTheme
        };
    }

});

jqmModule.provider('jqmViewCache', function () {
    return {
        $get: ['$cacheFactory', '$compile', '$http', '$templateCache', '$q', factory]
    };

    function factory($cacheFactory, $compile, $http, $templateCache, $q) {
        var jqmViewCache = $cacheFactory('jqmCachingView');

        return {
            cache: jqmViewCache,
            load: load
        };

        function load(scope, url) {
            var cacheKey = scope.$id+'@'+url,
                cacheEntryPromise = jqmViewCache.get(cacheKey);
            if (cacheEntryPromise) {
                return cacheEntryPromise;
            }
            cacheEntryPromise = $http.get(url, {cache: $templateCache}).then(function (response) {
                var compileElements = angular.element('<div></div>').html(response.data).contents();
                return createCacheEntry(scope, compileElements);
            });
            jqmViewCache.put(cacheKey, cacheEntryPromise);
            return cacheEntryPromise;
        }

        function createCacheEntry(scope, compileElements) {
            var currentIndex = 0,
                templateInstances = [],
                i,
                templateInstanceCount = 1,
                link;
            angular.forEach(compileElements, function (element) {
                var el;
                if (element.nodeType === window.Node.ELEMENT_NODE) {
                    el = angular.element(element);
                    if (angular.isDefined(el.attr('allow-same-view-animation')) ||
                        angular.isDefined(el.attr('data-allow-same-view-animation'))) {
                        templateInstanceCount = 2;
                    }
                }
            });
            link = $compile(compileElements);
            for (i = 0; i < templateInstanceCount; i++) {
                templateInstances.push(createTemplateInstance(link, scope, true));
            }
            return {
                get: get,
                next: next
            };

            function get(index) {
                if (!angular.isDefined(index)) {
                    index = currentIndex;
                }
                return templateInstances[index];
            }

            function next() {
                currentIndex++;
                if (currentIndex >= templateInstances.length) {
                    currentIndex = 0;
                }
                return get(currentIndex);
            }
        }

        function createTemplateInstance(link, scope, clone) {
            var ctrlScope = scope.$new(),
                directiveScope = ctrlScope.$new(),
                elements,
                cloneAttachFn;
            ctrlScope.$disconnect();
            ctrlScope.$destroy = scopeClearAndDisconnect;
            if (clone) {
                cloneAttachFn = angular.noop;
            }
            elements = link(directiveScope, cloneAttachFn);
            return {
                scope: ctrlScope,
                elements: elements
            };
        }
    }

    function scopeClearAndDisconnect() {
        /*jshint -W040:true*/
        var prop;
        // clear all watchers, listeners and all non angular properties,
        // so we have a fresh scope!
        this.$$watchers = [];
        this.$$listeners = [];
        for (prop in this) {
            if (this.hasOwnProperty(prop) && prop.charAt(0) !== '$') {
                delete this[prop];
            }
        }
        this.$disconnect();
    }




});
/**
 * @ngdoc function
 * @name jqm.$orientation
 * @requires $window
 * @requires $rootScope
 *
 * @description
 * Provides access to the orientation of the browser. This will also
 * broadcast a `$orientationChanged` event on the root scope and do a digest whenever the orientation changes.
 */
jqmModule.factory('$orientation', ['$window', '$rootScope', function($window, $rootScope) {
    if (!$window.addEventListener) {
        // For tests
        return angular.noop;
    }
    var lastOrientation = getOrientation(),
        VERTICAL = "vertical",
        HORIZONTAL = "horizontal";

    initOrientationChangeListening();

    return getOrientation;

    // ------------------

    function initOrientationChangeListening() {
        // Start listening for orientation changes
        $window.addEventListener('resize', resizeListener, false);

        function resizeListener() {
            if (!orientationChanged()) {
                return;
            }
            $rootScope.$apply(function() {
                $rootScope.$broadcast('$orientationChanged', getOrientation());
            });
        }
    }

    function getOrientation() {
        var w = $window.innerWidth,
            h = $window.innerHeight;
        if (h < 200) {
            // In case of the Android screen size bug we assume
            // vertical, as the keyboard takes the whole screen
            // when horizontal.
            // See http://stackoverflow.com/questions/7958527/jquery-mobile-footer-or-viewport-size-wrong-after-android-keyboard-show
            // and http://android-developers.blogspot.mx/2009/04/updating-applications-for-on-screen.html
            return VERTICAL;
        }
        if (w > h) {
            return HORIZONTAL;
        } else {
            return VERTICAL;
        }
    }

    function orientationChanged() {
        var newOrientation = getOrientation();
        if (lastOrientation === newOrientation) {
            return false;
        }
        lastOrientation = newOrientation;
        return true;
    }
}]);
jqmModule.config(['$provide', function ($provide) {
    $provide.decorator('$parse', ['$delegate', jqmScopeAsParseDecorator]);

    function jqmScopeAsParseDecorator($parse) {
        return function (expression) {
            if (!angular.isString(expression)) {
                // $parse is also used for calling functions (e.g. from $scope.eval),
                // which we don't want to intercept.
                return $parse(expression);
            }

            var evalFn = $parse(expression),
                assignFn = evalFn.assign;
            if (assignFn) {
                patchedEvalFn.assign = patchedAssign;
            }
            return patchedEvalFn;

            function patchedEvalFn(context, locals) {
                return callInContext(evalFn, context, locals);
            }

            function patchedAssign(context, value) {
                return callInContext(assignFn, context, value);
            }

            function callInContext(fn, context, secondArg) {
                var scopeAs = {},
                    earlyExit = true;
                while (context && context.hasOwnProperty("$$scopeAs")) {
                    scopeAs[context.$$scopeAs] = context;
                    context = context.$parent;
                    earlyExit = false;
                }
                if (earlyExit) {
                    return fn(context, secondArg);
                }
                // Temporarily add a property in the parent scope
                // to reference the child scope.
                // Needed as the assign function does not allow locals, otherwise
                // we could use the locals here (which would be more efficient!).
                context.$scopeAs = scopeAs;
                try {
                    /*jshint -W040:true*/
                    return fn.call(this, context, secondArg);
                } finally {
                    delete context.$scopeAs;
                }
            }
        };
    }
}]);

// Note: We don't create a directive for the html element,
// as sometimes people add the ng-app to the body element.
jqmModule.run(['$window', function($window) {
    angular.element($window.document.documentElement).addClass("ui-mobile");
}]);

jqmModule.config(['$provide', function($provide) {
    $provide.decorator('$route', ['$delegate', '$rootScope', '$history', function($route, $rootScope, $history) {
        $rootScope.$on('$routeChangeStart', function(event, newRoute) {
            if (newRoute) {
                newRoute.back = $history.activeIndex < $history.previousIndex;
            }
        });
        return $route;
    }]);
}]);
/**
 * In the docs, an embedded angular app is used. However, due to a bug,
 * the docs don't disconnect the embedded $rootScope from the real $rootScope.
 * By this, our embedded app will never get freed and it's watchers will still fire.
 */
jqmModule.run(['$rootElement', '$rootScope', function clearRootScopeOnRootElementDestroy($rootElement, $rootScope) {
    $rootElement.bind('$destroy', function() {
        $rootScope.$destroy();
        $rootScope.$$watchers = [];
        $rootScope.$$listeners = [];
    });
}]);

jqmModule.config(['$provide', function ($provide) {
    $provide.decorator('$rootScope', ['$delegate', scopeReconnectDecorator]);
    $provide.decorator('$rootScope', ['$delegate', 'jqmConfig', inheritThemeDecorator]);

    function scopeReconnectDecorator($rootScope) {
        $rootScope.$disconnect = function () {
            if (this.$root === this) {
                return; // we can't disconnect the root node;
            }
            var parent = this.$parent;
            this.$$disconnected = true;
            // See Scope.$destroy
            if (parent.$$childHead === this) {
                parent.$$childHead = this.$$nextSibling;
            }
            if (parent.$$childTail === this) {
                parent.$$childTail = this.$$prevSibling;
            }
            if (this.$$prevSibling) {
                this.$$prevSibling.$$nextSibling = this.$$nextSibling;
            }
            if (this.$$nextSibling) {
                this.$$nextSibling.$$prevSibling = this.$$prevSibling;
            }
            this.$$nextSibling = this.$$prevSibling = null;
        };
        $rootScope.$reconnect = function () {
            if (this.$root === this) {
                return; // we can't disconnect the root node;
            }
            var child = this;
            if (!child.$$disconnected) {
                return;
            }
            var parent = child.$parent;
            child.$$disconnected = false;
            // See Scope.$new for this logic...
            child.$$prevSibling = parent.$$childTail;
            if (parent.$$childHead) {
                parent.$$childTail.$$nextSibling = child;
                parent.$$childTail = child;
            } else {
                parent.$$childHead = parent.$$childTail = child;
            }

        };
        return $rootScope;
    }

    function inheritThemeDecorator($rootScope, jqmConfig) {
        instrumentScope($rootScope, jqmConfig.primaryTheme);
        return $rootScope;

        function instrumentScope(scope, theme) {
            scope.$theme = theme;
            var _new = scope.$new;
            scope.$new = function (isolate) {
                var res = _new.apply(this, arguments);
                if (isolate) {
                    instrumentScope(res, this.$theme);
                }
                return res;

            };
        }
    }
}]);

(function () {
    /*! matchMedia() polyfill - Test a CSS media type/query in JS. Authors & copyright (c) 2012: Scott Jehl, Paul Irish, Nicholas Zakas. Dual MIT/BSD license */
    window.matchMedia = window.matchMedia || (function (doc) {
        var bool,
        docElem = doc.documentElement,
        refNode = docElem.firstElementChild || docElem.firstChild,
        // fakeBody required for <FF4 when executed in <head>
        fakeBody = doc.createElement("body"),
        div = doc.createElement("div");

        div.id = "mq-test-1";
        div.style.cssText = "position:absolute;top:-100em";
        fakeBody.style.background = "none";
        fakeBody.appendChild(div);

        return function (q) {

            div.innerHTML = "&shy;<style media=\"" + q + "\"> #mq-test-1 { width: 42px; }</style>";

            docElem.insertBefore(fakeBody, refNode);
            bool = div.offsetWidth === 42;
            docElem.removeChild(fakeBody);

            return {
                matches: bool,
                media: q
            };

        };

    }(window.document));
})();

jqmModule.config(['$provide', function ($provide) {
    $provide.decorator('$sniffer', ['$delegate', '$window', '$document', function ($sniffer, $window, $document) {
        var fakeBody = angular.element("<body>");
        angular.element($window).prepend(fakeBody);

        $sniffer.cssTransform3d = transform3dTest();

        android2Transitions();

        fakeBody.remove();

        return $sniffer;

        function media(q) {
            return window.matchMedia(q).matches;
        }

        // This is a copy of jquery mobile 1.3.1 detection for transform3dTest
        function transform3dTest() {
            var mqProp = "transform-3d",
            vendors = [ "Webkit", "Moz", "O" ],
            // Because the `translate3d` test below throws false positives in Android:
            ret = media("(-" + vendors.join("-" + mqProp + "),(-") + "-" + mqProp + "),(" + mqProp + ")");

            if (ret) {
                return !!ret;
            }

            var el = $window.document.createElement("div"),
            transforms = {
                // We’re omitting Opera for the time being; MS uses unprefixed.
                'MozTransform': '-moz-transform',
                'transform': 'transform'
            };

            fakeBody.append(el);

            for (var t in transforms) {
                if (el.style[ t ] !== undefined) {
                    el.style[ t ] = 'translate3d( 100px, 1px, 1px )';
                    ret = window.getComputedStyle(el).getPropertyValue(transforms[ t ]);
                }
            }
            return ( !!ret && ret !== "none" );
        }

        //Fix android 2 not reading transitions correct.
        //https://github.com/angular/angular.js/pull/3086
        //https://github.com/opitzconsulting/angular-jqm/issues/89
        function android2Transitions() {
            if (!$sniffer.transitions || !$sniffer.animations) {
                $sniffer.transitions = angular.isString($document[0].body.style.webkitTransition);
                $sniffer.animations = angular.isString($document[0].body.style.webkitAnimation);
                if ($sniffer.animations || $sniffer.transitions) {
                    $sniffer.vendorPrefix = 'webkit';
                    $sniffer.cssTransform3d = true;
                }
            }
        }

    }]);
}]);

jqmModule.factory('$transitionComplete', ['$sniffer', function ($sniffer) {
    return function (el, callback, once) {
        var eventNames = 'transitionend';
        if (!$sniffer.transitions) {
            throw new Error("Browser does not support css transitions.");
        }
        if ($sniffer.vendorPrefix) {
            eventNames += " " + $sniffer.vendorPrefix.toLowerCase() + "TransitionEnd";
        }
        var _callback = callback;
        if (once) {
            callback = function() {
                unbind();
                _callback();
            };
        }
        //We have to split because unbind doesn't support multiple event names in one string
        //This will be fixed in 1.2, PR opened https://github.com/angular/angular.js/pull/3256
        angular.forEach(eventNames.split(' '), function(eventName) {
            el.bind(eventName, callback);
        });

        return unbind;

        function unbind() {
            angular.forEach(eventNames.split(' '), function(eventName) {
                el.unbind(eventName, callback);
            });
        }
    };
}]);

angular.module('jqm-templates', ['templates/jqmCheckbox.html', 'templates/jqmControlgroup.html', 'templates/jqmFlip.html', 'templates/jqmLiEntry.html', 'templates/jqmLiLink.html', 'templates/jqmListview.html', 'templates/jqmPanel.html', 'templates/jqmPanelContainer.html', 'templates/jqmTextarea.html', 'templates/jqmTextinput.html']);

angular.module("templates/jqmCheckbox.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("templates/jqmCheckbox.html",
    "<div jqm-scope-as=\"jqmCheckbox\"\n" +
    "     class=\"ui-checkbox\" jqm-class=\"{'ui-disabled': $scopeAs.jqmCheckbox.disabled}\">\n" +
    "    <label jqm-class=\"{'ui-checkbox-on': $scopeAs.jqmCheckbox.checked, 'ui-checkbox-off': !$scopeAs.jqmCheckbox.checked,\n" +
    "           'ui-first-child': $scopeAs.jqmCheckbox.$position.first, 'ui-last-child': $scopeAs.jqmCheckbox.$position.last,\n" +
    "           'ui-mini':$scopeAs.jqmCheckbox.isMini(), 'ui-fullsize':!$scopeAs.jqmCheckbox.isMini(),\n" +
    "           'ui-btn-active':$scopeAs.jqmCheckbox.isActive(),\n" +
    "           'ui-btn-icon-left': $scopeAs.jqmCheckbox.getIconPos()!='right', 'ui-btn-icon-right': $scopeAs.jqmCheckbox.getIconPos()=='right'}\"\n" +
    "           ng-click=\"$scopeAs.jqmCheckbox.toggleChecked()\"\n" +
    "           class=\"ui-btn ui-btn-corner-all\">\n" +
    "        <span class=\"ui-btn-inner\">\n" +
    "            <span class=\"ui-btn-text\" ng-transclude></span>\n" +
    "            <span jqm-class=\"{'ui-icon-checkbox-on': $scopeAs.jqmCheckbox.checked, 'ui-icon-checkbox-off': !$scopeAs.jqmCheckbox.checked}\"\n" +
    "                  class=\"ui-icon ui-icon-shadow\"></span>\n" +
    "        </span>\n" +
    "    </label>\n" +
    "    <input type=\"checkbox\" ng-model=\"$scopeAs.jqmCheckbox.checked\">\n" +
    "</div>\n" +
    "");
}]);

angular.module("templates/jqmControlgroup.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("templates/jqmControlgroup.html",
    "<fieldset class=\"ui-controlgroup\"\n" +
    "     jqm-class=\"{'ui-mini': mini, 'ui-shadow': shadow, 'ui-corner-all': corners!='false',\n" +
    "     'ui-controlgroup-vertical': type!='horizontal', 'ui-controlgroup-horizontal': type=='horizontal'}\">\n" +
    "    <div ng-if=\"legend\" class=\"ui-controlgroup-label\">\n" +
    "        <legend>{{legend}}</legend>\n" +
    "    </div>\n" +
    "    <div class=\"ui-controlgroup-controls\" ng-transclude jqm-position-anchor></div>\n" +
    "</fieldset>\n" +
    "");
}]);

angular.module("templates/jqmFlip.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("templates/jqmFlip.html",
    "<div jqm-scope-as=\"jqmFlip\">\n" +
    "        <label class=\"ui-slider\" ng-transclude></label>\n" +
    "        <div class=\"ui-slider ui-slider-switch ui-btn-down-{{$scopeAs.jqmFlip.theme}} ui-btn-corner-all\"\n" +
    "             jqm-class=\"{'ui-disabled': $scopeAs.jqmFlip.disabled,\n" +
    "                        'ui-mini': $scopeAs.jqmFlip.isMini()}\"\n" +
    "             ng-click=\"$scopeAs.jqmFlip.toggle()\">\n" +
    "             <span class=\"ui-slider-label ui-slider-label-a ui-btn-active ui-btn-corner-all\" ng-style=\"{width: $scopeAs.jqmFlip.onStyle + '%'}\">{{$scopeAs.jqmFlip.onLabel}}</span>\n" +
    "             <span class=\"ui-slider-label ui-slider-label-b ui-btn-down-{{$scopeAs.jqmFlip.theme}} ui-btn-corner-all\" ng-style=\"{width: $scopeAs.jqmFlip.offStyle + '%'}\">{{$scopeAs.jqmFlip.offLabel}}</span>\n" +
    "                <div class=\"ui-slider-inneroffset\">\n" +
    "                  <a class=\"ui-slider-handle ui-slider-handle-snapping ui-btn ui-btn-corner-all ui-btn-up-{{$scopeAs.jqmFlip.theme}} ui-shadow\"\n" +
    "                     title=\"{{$scopeAs.jqmFlip.toggleLabel}}\"\n" +
    "                     ng-style=\"{left: $scopeAs.jqmFlip.onStyle + '%'}\">\n" +
    "                    <span class=\"ui-btn-inner\"><span class=\"ui-btn-text\"></span></span>\n" +
    "                  </a>\n" +
    "                </div>\n" +
    "        </div>\n" +
    "</div>\n" +
    "");
}]);

angular.module("templates/jqmLiEntry.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("templates/jqmLiEntry.html",
    "<li class=\"ui-li\" jqm-scope-as=\"jqmLi\"\n" +
    "  jqm-once-class=\"{{$scopeAs.jqmLi.divider ? 'ui-li-divider ui-bar-'+$theme : 'ui-li-static jqm-active-toggle'}}\"\n" +
    "  jqm-class=\"{'ui-first-child': $scopeAs.jqmLi.$position.first, 'ui-last-child': $scopeAs.jqmLi.$position.last}\"\n" +
    "  ng-transclude>\n" +
    "</li>\n" +
    "");
}]);

angular.module("templates/jqmLiLink.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("templates/jqmLiLink.html",
    "<li class=\"ui-li ui-btn\" jqm-scope-as=\"jqmLiLink\"\n" +
    "  jqm-once-class=\"{{$scopeAs.jqmLiLink.icon ? 'ui-li-has-arrow ui-btn-icon-'+$scopeAs.jqmLiLink.iconpos : ''}}\"\n" +
    "  jqm-class=\"{'ui-first-child': $scopeAs.jqmLiLink.$position.first, \n" +
    "    'ui-last-child': $scopeAs.jqmLiLink.$position.last, \n" +
    "    'ui-li-has-thumb': $scopeAs.jqmLiLink.hasThumb, \n" +
    "    'ui-li-has-count': $scopeAs.jqmLiLink.hasCount}\">\n" +
    "  <div class=\"ui-btn-inner ui-li\">\n" +
    "      <div class=\"ui-btn-text\">\n" +
    "      <a ng-href=\"{{$scopeAs.jqmLiLink.link}}\" class=\"ui-link-inherit\" ng-transclude>\n" +
    "      </a>\n" +
    "    </div>\n" +
    "    <span ng-show=\"$scopeAs.jqmLiLink.icon\" \n" +
    "      class=\"ui-icon {{$scopeAs.jqmLiLink.icon}}\" \n" +
    "      jqm-class=\"{'ui-icon-shadow': $scopeAs.jqmLiLink.iconShadow}\">\n" +
    "      &nbsp;\n" +
    "    </span>\n" +
    "  </div>\n" +
    "</li>\n" +
    "");
}]);

angular.module("templates/jqmListview.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("templates/jqmListview.html",
    "<ul class=\"ui-listview\" jqm-scope-as=\"jqmListview\"\n" +
    "  jqm-class=\"{'ui-listview-inset': $scopeAs.jqmListview.inset,\n" +
    "    'ui-corner-all': $scopeAs.jqmListview.inset && $scopeAs.jqmListview.corners, \n" +
    "    'ui-shadow': $scopeAs.jqmListview.inset && $scopeAs.jqmListview.shadow}\"\n" +
    "  ng-transclude jqm-position-anchor>\n" +
    "</ul>\n" +
    "");
}]);

angular.module("templates/jqmPanel.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("templates/jqmPanel.html",
    "<div class=\"ui-panel ui-panel-closed\"\n" +
    "  ng-class=\"'ui-panel-position-'+position+' ui-panel-display-'+display+' ui-body-'+$theme+' ui-panel-animate'\">\n" +
    "  <div class=\"ui-panel-inner\" ng-transclude></div>\n" +
    "</div>\n" +
    "");
}]);

angular.module("templates/jqmPanelContainer.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("templates/jqmPanelContainer.html",
    "<div jqm-scope-as=\"pc\" ng-transclude class=\"jqm-panel-container\">\n" +
    "    <div class=\"ui-panel-dismiss\"\n" +
    "        ng-click=\"$scopeAs.pc.openPanelName = null\" ng-class=\"{\'ui-panel-dismiss-open\' : $scopeAs.pc.openPanelName}\"\n" +
    "    ></div>\n" +
    "</div>");
}]);

angular.module("templates/jqmTextarea.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("templates/jqmTextarea.html",
    "<textarea\n" +
    "        jqm-scope-as=\"jqmTextarea\"\n" +
    "        ng-class=\"{\'ui-disabled mobile-textinput-disabled ui-state-disabled\' : $scopeAs.jqmTextarea.disabled}\"\n" +
    "        class=\"ui-input-text ui-corner-all ui-shadow-inset ui-body-{{$scopeAs.jqmTextarea.$theme}}\">\n" +
    "</textarea>");
}]);

angular.module("templates/jqmTextinput.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("templates/jqmTextinput.html",
    "<div jqm-scope-as=\"jqmTextinput\"\n" +
    "     ng-class=\"{\n" +
    "        \'ui-input-has-clear\': ($scopeAs.jqmTextinput.clearBtn && !$scopeAs.jqmTextinput.isSearch()),\n" +
    "        \'ui-disabled\': $scopeAs.jqmTextinput.disabled,\n" +
    "        \'ui-mini\': $scopeAs.jqmTextinput.mini,\n" +
    "        \'ui-input-search ui-btn-corner-all ui-icon-searchfield\': $scopeAs.jqmTextinput.type === 'search',\n" +
    "        \'ui-input-text ui-corner-all\': !$scopeAs.jqmTextinput.isSearch()}\"\n" +
    "     class=\"ui-shadow-inset ui-btn-shadow ui-body-{{$scopeAs.jqmTextinput.$theme}}\">\n" +
    "    <input type=\"{{$scopeAs.jqmTextinput.typeValue}}\" class=\"ui-input-text ui-body-{{$scopeAs.jqmTextinput.$theme}}\"\n" +
    "           ng-class=\"{\'mobile-textinput-disabled ui-state-disabled\': $scopeAs.jqmTextinput.disabled}\" placeholder=\"{{$scopeAs.jqmTextinput.placeholder}}\">\n" +
    "    <a ng-if=\"$scopeAs.jqmTextinput.clearBtn || $scopeAs.jqmTextinput.type === 'search'\" href=\"#\" ng-class=\"{\'ui-input-clear-hidden\': !getValue()}\"\n" +
    "       ng-click=\"clearValue($event)\"\n" +
    "       class=\"ui-input-clear ui-btn ui-shadow ui-btn-corner-all ui-fullsize ui-btn-icon-notext\"\n" +
    "       title=\"{{clearBtnTextValue}}\">\n" +
    "   <span class=\"ui-btn-inner\">\n" +
    "                   <span class=\"ui-btn-text\" ng-bind=\"clearBtnTextValue\"></span>\n" +
    "                   <span class=\"ui-icon ui-icon-delete ui-icon-shadow\">&nbsp;</span>\n" +
    "               </span>\n" +
    "    </a>\n" +
    "\n" +
    "</div>");
}]);

angular.element(window.document).find('head').append('<style type="text/css">* {\n    -webkit-backface-visibility-hidden;\n}\nhtml, body {\n    -webkit-user-select: none;\n}\n\n/* browser resets */\n.ui-mobile, .ui-mobile html, .ui-mobile body {\n    height: 100%;\n    margin: 0\n}\n\n.ui-footer {\n    position: absolute;\n    bottom: 0;\n    width: 100%;\n    z-index: 1\n}\n\n.ui-header {\n    position: absolute;\n    top: 0;\n    width: 100%;\n    z-index: 1\n}\n\n.ui-mobile .ui-page {\n    height: 100%;\n    min-height: 0;\n    overflow: hidden;\n}\n.ui-content {\n    position: relative;\n    margin: 0;\n    padding: 0;\n}\n.ui-content.jqm-content-with-header {\n    margin-top: 42px\n}\n\n.ui-content.jqm-content-with-footer {\n    margin-bottom: 43px\n}\n.jqm-standalone-page {\n    display: block;\n    position: relative;\n}\n.ui-panel {\n  position: absolute;\n}\n\n.ui-panel-closed {\n  display: none;\n}\n\n.ui-panel.ui-panel-opened {\n  z-index: 1001;\n}\n.ui-panel-dismiss {\n  z-index: 1000; /* lower than ui-panel */\n}\n\n.ui-panel-content-wrap {\n    height: 100%\n}\n\n.jqm-panel-container {\n    position: relative\n}\n\n\n.ui-mobile-viewport {\n    /* needed to allow multiple viewports */\n    position: relative;\n    height:100%\n}\n</style>');})(window, angular);