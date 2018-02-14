(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var righto = require('righto');
var textWrapper = document.createElement('text-wrapper');
textWrapper.style.display = 'inline';

function getRect(node){
    if(!node){
        return;
    }

    if(node.nodeType === 3){
        return getTextRect(node);
    }

    if(node.nodeType === 1){
        return node.getBoundingClientRect();
    }
}

function getTextRect(textNode){
    if(textNode.textContent.trim()){
        textNode.replaceWith(textWrapper);
        textWrapper.appendChild(textNode);

        var nodeRect = getRect(textWrapper);
        textWrapper.replaceWith(textNode);
        return nodeRect;
    }
}

function balanceTextNode(node, targetPageBottom){
    var textNodeClone = node.cloneNode(true);
    var textContent = node.textContent;
    node.parentElement.insertBefore(textWrapper, node);
    textWrapper.appendChild(textNodeClone);

    var splitLength = Math.floor(textContent.length / 2);

    while(splitLength > 1){
        if(getRect(textWrapper).bottom < targetPageBottom){
            textNodeClone.textContent += textContent.slice(textNodeClone.textContent.length, textNodeClone.textContent.length + splitLength);
        }else{
            textNodeClone.textContent = textNodeClone.textContent.slice(0, -splitLength);
        }

        splitLength = Math.floor(splitLength / 2);
    }

    textWrapper.replaceWith(textNodeClone);

    return textNodeClone;
}

function createPrintClone(element, deep){
    var clone = element.cloneNode(deep);
    clone.setAttribute("isPrintSplitClone", "");
    return clone;
}

function clearPageBrakeMargins(element){
    if(element.nodeType !== 1){
        return;
    }

    if(element.hasAttribute('isPrintSplitBreakBefore')){
        element.style.marginTop = JSON.parse(element.getAttribute('isPrintSplitBreakBefore'));
        element.removeAttribute('isPrintSplitBreakBefore');
    }
    if(element.hasAttribute('isPrintSplitBreakAfter')){
        element.style.marginBottom = JSON.parse(element.getAttribute('isPrintSplitBreakAfter'));
        element.removeAttribute('isPrintSplitBreakAfter');
    }
}

function getAdjacentPageElement(parentPage, element, direction){
    var adjacentProperty = direction === 'previous' ? 'previousElementSibling' : 'nextElementSibling';
    while (element !== parentPage){
        if(element[adjacentProperty]){
            return element[adjacentProperty];
        }

        element = element.parentElement;
    }
}

function fixTable(table){
    if(table.getAttribute('isPrintSplitFixed')){
        return;
    }

    table.setAttribute('isPrintSplitFixed', 'true');

    var rows = Array.prototype.slice.call(table.querySelectorAll('tr'));

    if(!rows.length){
        return;
    }

    var columnWidths = Array.prototype.map.call(rows[0].querySelectorAll('td, th'), function(cell){
        return cell.getBoundingClientRect().width + 10;
    });

    var tableWidth = columnWidths.reduce((a, b) => a + b);
    table.style['table-layout'] = 'fixed';
    table.style['width'] = tableWidth + 'px';

    Array.prototype.forEach.call(rows, function(row){
        Array.prototype.forEach.call(row.querySelectorAll('td, th'), function(cell, index){
            cell.style['width'] = (100 / tableWidth * columnWidths[index]) + '%';
        });
    });
}

function printify(parentPage, target, rect, height, minSplitHeight, nextSplitParent, lastPageOffset, options){
    var pageBottom = height + lastPageOffset;

    var needsNewRect;

    var childRects = Array.prototype.forEach.call(target.childNodes, function(child){
        if(child.nodeType === 1 && options.shouldPageBrake){
            var targetStyle = window.getComputedStyle(target);
            var parentPaddingBottom = parseInt(targetStyle['padding-bottom']);
            var isPrintSplitBreakBefore = child.hasAttribute('isPrintSplitBreakBefore');

            if(isPrintSplitBreakBefore){
                child.style.marginTop = JSON.parse(child.getAttribute('isPrintSplitBreakBefore'));
            }

            var breakSide = options.shouldPageBrake(child);
            var childRect = getRect(child);

            if(breakSide && childRect.top < rect.bottom && childRect.top < pageBottom){
                if(
                    !isPrintSplitBreakBefore &&
                    ~breakSide.indexOf('before') &&
                    getAdjacentPageElement(parentPage, child, 'previous')
                ){
                    var margin = height - (childRect.top - rect.top);
                    child.setAttribute('isPrintSplitBreakBefore', JSON.stringify(child.style.marginTop));
                    child.style.marginTop = margin + 'px';
                    needsNewRect = true;
                } else if(
                    ~breakSide.indexOf('after') &&
                    getAdjacentPageElement(parentPage, child, 'next')
                ){
                    var margin = height;
                    child.setAttribute('isPrintSplitBreakAfter', JSON.stringify(child.style.marginBottom));
                    child.style.marginBottom = margin + 'px';
                    needsNewRect = true;
                }
            }
        }
    }, []);

    if(needsNewRect){
        rect = getRect(target);
    }

    if(rect.top < pageBottom && rect.bottom > pageBottom){
        var targetStyle = window.getComputedStyle(target);
        var parentPaddingBottom = parseInt(targetStyle['padding-bottom']);
        var innerHeight = height - parentPaddingBottom;
        var targetPageBottom = pageBottom - parentPaddingBottom;

        if(target.nodeName === 'TABLE'){
            fixTable(target);
        }

        var clone = createPrintClone(target);

        // Get child locations
        var childRects = Array.prototype.reduce.call(target.childNodes, function(results, child){
            var nodeRect = getRect(child);

            if(nodeRect){
                results.push([child, nodeRect]);
            }

            return results;
        }, []);

        // Cleanup page brake children
        childRects.forEach(childRectInfo => clearPageBrakeMargins(childRectInfo[0]));

        // Get children that overflow the page
        var offPageChildRects = childRects.filter(function(childRectInfo){
            return childRectInfo[1].bottom > targetPageBottom;
        });

        // Distinguish between children completely off the page, and partially across the page
        var [ splitPageChildRects, nextPageChildRects ] = offPageChildRects.reduce(function(pages, childRectInfo){
            if(
                childRectInfo[0].nodeType === 3 &&
                childRectInfo[1].height > minSplitHeight &&
                childRectInfo[1].top < targetPageBottom
            ){
                if(childRectInfo[1].bottom < targetPageBottom){
                    pages[0].push(childRectInfo);
                    return pages;
                }

                var childTextNode = childRectInfo[0];
                var textNodeClone = balanceTextNode(childTextNode, targetPageBottom);

                childTextNode.textContent = childTextNode.textContent.slice(textNodeClone.textContent.length);
                textWrapper.appendChild(childTextNode);
                var childRect = getRect(textWrapper);
                textWrapper.replaceWith(childTextNode);

                pages[1].push([childTextNode, childRect]);
                return pages;
            }

            if(
                childRectInfo[1].height <= minSplitHeight ||
                !childRectInfo[0].hasChildNodes() && childRectInfo[1].height < height ||
                childRectInfo[1].top > targetPageBottom
            ){
                pages[1].push(childRectInfo);
            } else {
                pages[0].push(childRectInfo);
            }

            return pages;
        }, [[], []]);

        var nextPageElements = document.createDocumentFragment();
        nextPageElements.append.apply(nextPageElements, nextPageChildRects.map(x => x[0]));

        clone.insertBefore(nextPageElements, clone.firstChild);

        if(nextSplitParent){
            var lastInsertedClone = nextSplitParent.querySelector("[isPrintSplitClone]");
            nextSplitParent.insertBefore(clone, lastInsertedClone ? lastInsertedClone.nextSibling : nextSplitParent.firstChild);
        }else{
            target.parentElement.insertBefore(clone, target.nextSibling);
        }

        splitPageChildRects.forEach(function(childRectInfo){
            printify(parentPage, childRectInfo[0], childRectInfo[1], innerHeight, minSplitHeight, clone, lastPageOffset, options);
        });

        if(!nextSplitParent){
            target.style.height = height + 'px';
            var rect = getRect(clone);

            return [clone, clone, rect, height, minSplitHeight, null, rect.top, options];
        }

    } else {
        if(!nextSplitParent){
            target.style.height = height + 'px';
        }
    }
}

module.exports = function(target, height, minSplitHeight, options){
    var cloneStyle = document.createElement('style');
    cloneStyle.textContent = '[isPrintSplitClone]{visibility:hidden;}';
    document.body.appendChild(cloneStyle);
    var targetClone = createPrintClone(target, true);
    target.parentElement.insertBefore(targetClone, target);
    targetClone.normalize();
    targetClone.style.transform = 'rotateZ(0)';
    var rect = getRect(targetClone);
    var pages = [targetClone];

    var next = [targetClone, targetClone, rect, height, minSplitHeight, null, rect.top, options];

    do {
        next = printify.apply(null, next);
        if(next){
            pages.push(next[0]);
        }
    } while(next);

    Array.prototype.slice.apply(target.querySelectorAll('[isPrintSplitBreak]')).forEach(function(element){
        clearPageBrakeMargins(element);
    });

    targetClone.style.transform = null;
    cloneStyle.remove();
    return pages;
};
},{"righto":4}],2:[function(require,module,exports){
function checkIfPromise(promise){
    if(!promise || typeof promise !== 'object' || typeof promise.then !== 'function'){
        throw "Abbott requires a promise to break. It is the only thing Abbott is good at.";
    }
}

module.exports = function abbott(promiseOrFn){
    if(typeof promiseOrFn !== 'function'){
        checkIfPromise(promiseOrFn);
    }

    return function(){
        var promise;
        if(typeof promiseOrFn === 'function'){
           promise = promiseOrFn.apply(null, Array.prototype.slice.call(arguments, 0, -1));
        }else{
            promise = promiseOrFn;
        }

        checkIfPromise(promise);

        var callback = arguments[arguments.length-1];
        promise.then(callback.bind(null, null), callback);
    };
};
},{}],3:[function(require,module,exports){
//Copyright (C) 2012 Kory Nunn

//Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

//The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/*

    This code is not formatted for readability, but rather run-speed and to assist compilers.

    However, the code's intention should be transparent.

    *** IE SUPPORT ***

    If you require this library to work in IE7, add the following after declaring crel.

    var testDiv = document.createElement('div'),
        testLabel = document.createElement('label');

    testDiv.setAttribute('class', 'a');
    testDiv['className'] !== 'a' ? crel.attrMap['class'] = 'className':undefined;
    testDiv.setAttribute('name','a');
    testDiv['name'] !== 'a' ? crel.attrMap['name'] = function(element, value){
        element.id = value;
    }:undefined;


    testLabel.setAttribute('for', 'a');
    testLabel['htmlFor'] !== 'a' ? crel.attrMap['for'] = 'htmlFor':undefined;



*/

(function (root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        root.crel = factory();
    }
}(this, function () {
    var fn = 'function',
        obj = 'object',
        nodeType = 'nodeType',
        textContent = 'textContent',
        setAttribute = 'setAttribute',
        attrMapString = 'attrMap',
        isNodeString = 'isNode',
        isElementString = 'isElement',
        d = typeof document === obj ? document : {},
        isType = function(a, type){
            return typeof a === type;
        },
        isNode = typeof Node === fn ? function (object) {
            return object instanceof Node;
        } :
        // in IE <= 8 Node is an object, obviously..
        function(object){
            return object &&
                isType(object, obj) &&
                (nodeType in object) &&
                isType(object.ownerDocument,obj);
        },
        isElement = function (object) {
            return crel[isNodeString](object) && object[nodeType] === 1;
        },
        isArray = function(a){
            return a instanceof Array;
        },
        appendChild = function(element, child) {
            if (isArray(child)) {
                child.map(function(subChild){
                    appendChild(element, subChild);
                });
                return;
            }
            if(!crel[isNodeString](child)){
                child = d.createTextNode(child);
            }
            element.appendChild(child);
        };


    function crel(){
        var args = arguments, //Note: assigned to a variable to assist compilers. Saves about 40 bytes in closure compiler. Has negligable effect on performance.
            element = args[0],
            child,
            settings = args[1],
            childIndex = 2,
            argumentsLength = args.length,
            attributeMap = crel[attrMapString];

        element = crel[isElementString](element) ? element : d.createElement(element);
        // shortcut
        if(argumentsLength === 1){
            return element;
        }

        if(!isType(settings,obj) || crel[isNodeString](settings) || isArray(settings)) {
            --childIndex;
            settings = null;
        }

        // shortcut if there is only one child that is a string
        if((argumentsLength - childIndex) === 1 && isType(args[childIndex], 'string') && element[textContent] !== undefined){
            element[textContent] = args[childIndex];
        }else{
            for(; childIndex < argumentsLength; ++childIndex){
                child = args[childIndex];

                if(child == null){
                    continue;
                }

                if (isArray(child)) {
                  for (var i=0; i < child.length; ++i) {
                    appendChild(element, child[i]);
                  }
                } else {
                  appendChild(element, child);
                }
            }
        }

        for(var key in settings){
            if(!attributeMap[key]){
                if(isType(settings[key],fn)){
                    element[key] = settings[key];
                }else{
                    element[setAttribute](key, settings[key]);
                }
            }else{
                var attr = attributeMap[key];
                if(typeof attr === fn){
                    attr(element, settings[key]);
                }else{
                    element[setAttribute](attr, settings[key]);
                }
            }
        }

        return element;
    }

    // Used for mapping one kind of attribute to the supported version of that in bad browsers.
    crel[attrMapString] = {};

    crel[isElementString] = isElement;

    crel[isNodeString] = isNode;

    if(typeof Proxy !== 'undefined'){
        crel.proxy = new Proxy(crel, {
            get: function(target, key){
                !(key in crel) && (crel[key] = crel.bind(null, key));
                return crel[key];
            }
        });
    }

    return crel;
}));

},{}],4:[function(require,module,exports){
(function (global){
var abbott = require('abbott');

var defer = global.process && global.process.nextTick || global.setImmediate || global.setTimeout;

function isRighto(x){
    return typeof x === 'function' && (x.__resolve__ === x || x.resolve === x);
}

function isThenable(x){
    return x && typeof x.then === 'function' && !isRighto(x);
}

function isResolvable(x){
    return isRighto(x) || isThenable(x);
}

function isTake(x){
    return x && typeof x === 'object' && '__take__' in x;
}

var slice = Array.prototype.slice.call.bind(Array.prototype.slice);

function getCallLine(stack){
    var index = 0,
        lines = stack.split('\n');

    while(lines[++index] && lines[index].match(/righto\/index\.js/)){}

    var match = lines[index] && lines[index].match(/at (.*)/);

    return match ? match[1] : ' - No trace - ';
}

function resolveDependency(task, done){
    if(isThenable(task)){
        task = righto(abbott(task));
    }

    if(isRighto(task)){
        return task(function(error){
            var results = slice(arguments, 1, 2);

            if(!results.length){
                results.push(undefined);
            }

            done(error, results);
        });
    }

    function take(targetTask){
        var keys = slice(arguments, 1);
        return targetTask(function(error){
            var args = slice(arguments, 1);
            done(error, keys.map(function(key){
                return args[key];
            }));
        });
    }

    if(
        righto._debug &&
        righto._warnOnUnsupported &&
        Array.isArray(task) &&
        isRighto(task[0]) &&
        !isRighto(task[1])
    ){

        console.warn('\u001b[33mPossible unsupported take/ignore syntax detected:\u001b[39m\n' + getCallLine(this._stack));
    }

    if(isTake(task)){
        return take.apply(null, task.__take__);
    }

    return done(null, [task]);
}

function traceGet(instance, result){
    if(righto._debug && !(typeof result === 'object' || typeof result === 'function')){
        var line = getCallLine(instance._stack);
        throw new Error('Result of righto was not an instance at: \n' + line);
    }
}

function get(fn){
    var instance = this;
    return righto(function(result, fn, done){
        if(typeof fn === 'string' || typeof fn === 'number'){
            traceGet(instance, result);
            return done(null, result[fn]);
        }

        righto.from(fn(result))(done);
    }, this, fn);
}

var noOp = function(){};

function proxy(instance){
    instance._ = new Proxy(instance, {
        get: function(target, key){
            if(key === '__resolve__'){
                return instance._;
            }

            if(instance[key] || key in instance || key === 'inspect' || typeof key === 'symbol'){
                return instance[key];
            }

            if(righto._debug && key.charAt(0) === '_'){
                return instance[key];
            }

            return proxy(righto.sync(function(result){
                traceGet(instance, result);
                return result[key];
            }, instance));
        }
    });
    instance.__resolve__ = instance._;
    return instance._;
}

function resolveIterator(fn){
    return function(){
        var args = slice(arguments),
            callback = args.pop(),
            errored,
            lastValue;

        function reject(error){
            if(errored){
                return;
            }
            errored = true;
            callback(error);
        }

        var generator = fn.apply(null, args.concat(reject));

        function run(){
            if(errored){
                return;
            }
            var next = generator.next(lastValue);
            if(next.done){
                if(errored){
                    return;
                }
                return callback(null, next.value);
            }
            if(isResolvable(next.value)){
                righto.sync(function(value){
                    lastValue = value;
                    run();
                }, next.value)(function(error){
                    if(error){
                        reject(error);
                    }
                });
                return;
            }
            lastValue = next.value;
            run();
        }

        run();
    };
}

function addTracing(resolve, fn, args){

    var argMatch = fn.toString().match(/^[\w\s]*?\(((?:\w+[,\s]*?)*)\)/),
        argNames = argMatch ? argMatch[1].split(/[,\s]+/g) : [];

    resolve._stack = new Error().stack;
    resolve._trace = function(tabs){
        var firstLine = getCallLine(resolve._stack);

        if(resolve._error){
            firstLine = '\u001b[31m' + firstLine + ' <- ERROR SOURCE' +  '\u001b[39m';
        }

        tabs = tabs || 0;
        var spacing = '    ';
        for(var i = 0; i < tabs; i ++){
            spacing = spacing + '    ';
        }
        return args.map(function(arg, index){
            return [arg, argNames[index] || index];
        }).reduce(function(results, argInfo){
            var arg = argInfo[0],
                argName = argInfo[1];

            if(isTake(arg)){
                arg = arg.__take__[0];
            }

            if(isRighto(arg)){
                var line = spacing + '- argument "' + argName + '" from ';


                if(!arg._trace){
                    line = line + 'Tracing was not enabled for this righto instance.';
                }else{
                    line = line + arg._trace(tabs + 1);
                }
                results.push(line);
            }

            return results;
        }, [firstLine])
        .join('\n');
    };
}

function taskComplete(error){
    var done = this[0],
        context = this[1],
        callbacks = context.callbacks;

    if(error && righto._debug){
        context.resolve._error = error;
    }

    var results = arguments;

    done(results);

    for(var i = 0; i < callbacks.length; i++){
        defer(callbacks[i].apply.bind(callbacks[i], null, results));
    }
}

function errorOut(error, callback){
    if(error && righto._debug){
        if(righto._autotraceOnError || this.resolve._traceOnError){
            console.log('Dependency error executing ' + this.fn.name + ' ' + this.resolve._trace());
        }
    }

    callback(error);
}

function debugResolve(context, args, complete){
    try{
        args.push(complete);
        context.fn.apply(null, args);
    }catch(error){
        console.log('Task exception executing ' + context.fn.name + ' from ' + context.resolve._trace());
        throw error;
    }
}

function resolveWithDependencies(done, error, argResults){
    var context = this;

    if(error){
        var boundErrorOut = errorOut.bind(context, error);

        for(var i = 0; i < context.callbacks.length; i++){
            boundErrorOut(context.callbacks[i]);
        }

        return;
    }

    var args = [].concat.apply([], argResults),
        complete = taskComplete.bind([done, context]);

    if(righto._debug){
        return debugResolve(context, args, complete);
    }

    // Slight perf bump by avoiding apply for simple cases.
    switch(args.length){
        case 0: context.fn(complete); break;
        case 1: context.fn(args[0], complete); break;
        case 2: context.fn(args[0], args[1], complete); break;
        case 3: context.fn(args[0], args[1], args[2], complete); break;
        default:
            args.push(complete);
            context.fn.apply(null, args);
    }
}

function resolveDependencies(args, complete, resolveDependency){
    var results = [],
        done = 0,
        hasErrored;

    if(!args.length){
        complete(null, []);
    }

    function dependencyResolved(index, error, result){
        if(hasErrored){
            return;
        }

        if(error){
            hasErrored = true;
            return complete(error);
        }

        results[index] = result;

        if(++done === args.length){
            complete(null, results);
        }
    }

    for(var i = 0; i < args.length; i++){
        resolveDependency(args[i], dependencyResolved.bind(null, i));
    }
}

function resolver(complete){
    var context = this;

    // No callback? Just run the task.
    if(!arguments.length){
        complete = noOp;
    }

    if(isRighto(complete)){
        throw new Error('righto instance passed into a righto instance instead of a callback');
    }

    if(typeof complete !== 'function'){
        throw new Error('Callback must be a function');
    }

    if(context.results){
        return complete.apply(null, context.results);
    }

    context.callbacks.push(complete);

    if(context.started++){
        return;
    }

    var resolved = resolveWithDependencies.bind(context, function(resolvedResults){
            if(righto._debug){
                if(righto._autotrace || context.resolve._traceOnExecute){
                    console.log('Executing ' + context.fn.name + ' ' + context.resolve._trace());
                }
            }

            context.results = resolvedResults;
        });

    defer(resolveDependencies.bind(null, context.args, resolved, resolveDependency.bind(context.resolve)));

    return context.resolve;
};

function righto(){
    var args = slice(arguments),
        fn = args.shift();

    if(typeof fn !== 'function'){
        throw new Error('No task function passed to righto');
    }

    if(isRighto(fn) && args.length > 0){
        throw new Error('Righto task passed as target task to righto()');
    }

    var resolverContext = {
            fn: fn,
            callbacks: [],
            args: args,
            started: 0
        },
        resolve = resolver.bind(resolverContext);
    resolve.get = get.bind(resolve);
    resolverContext.resolve = resolve;
    resolve.resolve = resolve;

    if(righto._debug){
        addTracing(resolve, fn, args);
    }

    return resolve;
}

righto.sync = function(fn){
    return righto.apply(null, [function(){
        var args = slice(arguments),
            done = args.pop(),
            result = fn.apply(null, args);

        if(isResolvable(result)){
            return righto.from(result)(done);
        }

        done(null, result);
    }].concat(slice(arguments, 1)));
};

righto.all = function(value){
    var task = value;
    if(arguments.length > 1){
        task = slice(arguments);
    }

    function resolve(tasks){
        return righto.apply(null, [function(){
            arguments[arguments.length - 1](null, slice(arguments, 0, -1));
        }].concat(tasks));
    }

    if(isRighto(task)){
        return righto(function(tasks, done){
            resolve(tasks)(done);
        }, task);
    }

    return resolve(task);
};

righto.reduce = function(values, reducer, seed){
    var hasSeed = arguments.length >= 3;

    if(!reducer){
        reducer = function(previous, next){
            return righto(next);
        };
    }

    return righto.from(values).get(function(values){
        if(!values || !values.reduce){
            throw new Error('values was not a reduceable object (like an array)');
        }

        if(!values.length){
            return righto.from(undefined);
        }

        values = values.slice();

        if(!hasSeed){
            seed = righto(values.shift());
        }

        return values.reduce(function(previous, next){
            return righto.sync(reducer, previous, righto.value(next));
        }, seed);
    });
};

righto.from = function(value){
    if(isRighto(value)){
        return value;
    }

    if(!isResolvable(value) && typeof value === 'function'){
        return righto.all(slice(arguments, 1)).get(function(args){
            return righto.from(value.apply(null, args));
        });
    }

    return righto.sync(function(resolved){
        return resolved;
    }, value);
};

righto.mate = function(){
    return righto.apply(null, [function(){
        arguments[arguments.length -1].apply(null, [null].concat(slice(arguments, 0, -1)));
    }].concat(slice(arguments)));
};

righto.take = function(task){
    if(!isResolvable(task)){
        throw new Error('task was not a resolvable value');
    }

    return {__take__: slice(arguments)};
};

righto.after = function(task){
    if(!isResolvable(task)){
        throw new Error('task was not a resolvable value');
    }

    if(arguments.length === 1){
        return {__take__: [task]};
    }

    return {__take__: [righto.mate.apply(null, arguments)]};
};

righto.resolve = function(object, deep){
    if(isRighto(object)){
        return righto.sync(function(object){
            return righto.resolve(object, deep);
        }, object);
    }

    if(!object || !(typeof object === 'object' || typeof object === 'function')){
        return righto.from(object);
    }

    var pairs = righto.all(Object.keys(object).map(function(key){
        return righto(function(value, done){
            if(deep){
                righto.sync(function(value){
                    return [key, value];
                }, righto.resolve(value, true))(done);
                return;
            }
            done(null, [key, value]);
        }, object[key]);
    }));

    return righto.sync(function(pairs){
        return pairs.reduce(function(result, pair){
            result[pair[0]] = pair[1];
            return result;
        }, Array.isArray(object) ? [] : {});
    }, pairs);
};

righto.iterate = function(){
    var args = slice(arguments),
        fn = args.shift();

    return righto.apply(null, [resolveIterator(fn)].concat(args));
};

righto.value = function(){
    var args = arguments;
    return righto(function(done){
        done.apply(null, [null].concat(slice(args)));
    });
};

righto.surely = function(task){
    if(!isResolvable(task)){
        task = righto.apply(null, arguments);
    }

    return righto(function(done){
        task(function(){
            done(null, slice(arguments));
        });
    });
};

righto.handle = function(task, handler){
    return righto(function(handler, done){
        task(function(error){
            if(!error){
                return task(done);
            }

            handler(error, done);
        });
    }, handler);
};

righto.fail = function(error){
    return righto(function(error, done){
        done(error);
    }, error);
};

righto.fork = function(value){
    return function(resolve, reject){
        righto.from(value)(function(error, result){
            if(error){
                return reject(error);
            }

            resolve(result);
        });
    };
};

righto.isRighto = isRighto;
righto.isThenable = isThenable;
righto.isResolvable = isResolvable;

righto.proxy = function(){
    if(typeof Proxy === 'undefined'){
        throw new Error('This environment does not support Proxy\'s');
    }

    return proxy(righto.apply(this, arguments));
};

for(var key in righto){
    righto.proxy[key] = righto[key];
}

module.exports = righto;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"abbott":2}],5:[function(require,module,exports){
var splitter = require('../');
var crel = require('crel');

window.addEventListener('load', function(){

    var rows = document.createDocumentFragment();
    var headerRow = crel('tr',
        crel('th', 'cell 1 - header ', i),
        crel('th', 'cell 2 - header'),
        crel('th', 'cell 3 - header'),
        crel('th', 'cell 4 - header')
    );
    rows.appendChild(headerRow);

    for(var i = 0; i < 200; i ++){
        var row = crel('tr',
            crel('td', 'cell 1 - row ', i),
            crel('td', 'cell 2'),
            crel('td', 'cell 3'),
            crel('td', 'cell 4')
        );
        rows.appendChild(row);
    }

    document.querySelector('.data').appendChild(rows);

    function print(){
        var pageElement = document.querySelector('.page');
        pageElement.style.width = '778px';

        var pages = splitter(pageElement, 1082, 200, {
            shouldPageBrake: element => (element.getAttribute('pageBreak') || '').split(' ')
        });
        var exitPrintViewButton = crel('button', { class: 'exitPrintView' }, 'Close print view');
        var printWrapper = crel('div', { class: 'printWrapper' }, exitPrintViewButton, pages);
        crel(document.body, printWrapper);
        pageElement.style.width = null;

        function exitPrintView(){
            printWrapper.remove();
        }

        exitPrintViewButton.addEventListener('click', exitPrintView);
    }

    document.querySelector('button.print').addEventListener('click', print);
});
},{"../":1,"crel":3}]},{},[5])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9hYmJvdHQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvY3JlbC9jcmVsLmpzIiwibm9kZV9tb2R1bGVzL3JpZ2h0by9pbmRleC5qcyIsInRlc3QvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3RLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN2bEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIHJpZ2h0byA9IHJlcXVpcmUoJ3JpZ2h0bycpO1xudmFyIHRleHRXcmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGV4dC13cmFwcGVyJyk7XG50ZXh0V3JhcHBlci5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG5cbmZ1bmN0aW9uIGdldFJlY3Qobm9kZSl7XG4gICAgaWYoIW5vZGUpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYobm9kZS5ub2RlVHlwZSA9PT0gMyl7XG4gICAgICAgIHJldHVybiBnZXRUZXh0UmVjdChub2RlKTtcbiAgICB9XG5cbiAgICBpZihub2RlLm5vZGVUeXBlID09PSAxKXtcbiAgICAgICAgcmV0dXJuIG5vZGUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRUZXh0UmVjdCh0ZXh0Tm9kZSl7XG4gICAgaWYodGV4dE5vZGUudGV4dENvbnRlbnQudHJpbSgpKXtcbiAgICAgICAgdGV4dE5vZGUucmVwbGFjZVdpdGgodGV4dFdyYXBwZXIpO1xuICAgICAgICB0ZXh0V3JhcHBlci5hcHBlbmRDaGlsZCh0ZXh0Tm9kZSk7XG5cbiAgICAgICAgdmFyIG5vZGVSZWN0ID0gZ2V0UmVjdCh0ZXh0V3JhcHBlcik7XG4gICAgICAgIHRleHRXcmFwcGVyLnJlcGxhY2VXaXRoKHRleHROb2RlKTtcbiAgICAgICAgcmV0dXJuIG5vZGVSZWN0O1xuICAgIH1cbn1cblxuZnVuY3Rpb24gYmFsYW5jZVRleHROb2RlKG5vZGUsIHRhcmdldFBhZ2VCb3R0b20pe1xuICAgIHZhciB0ZXh0Tm9kZUNsb25lID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgdmFyIHRleHRDb250ZW50ID0gbm9kZS50ZXh0Q29udGVudDtcbiAgICBub2RlLnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKHRleHRXcmFwcGVyLCBub2RlKTtcbiAgICB0ZXh0V3JhcHBlci5hcHBlbmRDaGlsZCh0ZXh0Tm9kZUNsb25lKTtcblxuICAgIHZhciBzcGxpdExlbmd0aCA9IE1hdGguZmxvb3IodGV4dENvbnRlbnQubGVuZ3RoIC8gMik7XG5cbiAgICB3aGlsZShzcGxpdExlbmd0aCA+IDEpe1xuICAgICAgICBpZihnZXRSZWN0KHRleHRXcmFwcGVyKS5ib3R0b20gPCB0YXJnZXRQYWdlQm90dG9tKXtcbiAgICAgICAgICAgIHRleHROb2RlQ2xvbmUudGV4dENvbnRlbnQgKz0gdGV4dENvbnRlbnQuc2xpY2UodGV4dE5vZGVDbG9uZS50ZXh0Q29udGVudC5sZW5ndGgsIHRleHROb2RlQ2xvbmUudGV4dENvbnRlbnQubGVuZ3RoICsgc3BsaXRMZW5ndGgpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHRleHROb2RlQ2xvbmUudGV4dENvbnRlbnQgPSB0ZXh0Tm9kZUNsb25lLnRleHRDb250ZW50LnNsaWNlKDAsIC1zcGxpdExlbmd0aCk7XG4gICAgICAgIH1cblxuICAgICAgICBzcGxpdExlbmd0aCA9IE1hdGguZmxvb3Ioc3BsaXRMZW5ndGggLyAyKTtcbiAgICB9XG5cbiAgICB0ZXh0V3JhcHBlci5yZXBsYWNlV2l0aCh0ZXh0Tm9kZUNsb25lKTtcblxuICAgIHJldHVybiB0ZXh0Tm9kZUNsb25lO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVQcmludENsb25lKGVsZW1lbnQsIGRlZXApe1xuICAgIHZhciBjbG9uZSA9IGVsZW1lbnQuY2xvbmVOb2RlKGRlZXApO1xuICAgIGNsb25lLnNldEF0dHJpYnV0ZShcImlzUHJpbnRTcGxpdENsb25lXCIsIFwiXCIpO1xuICAgIHJldHVybiBjbG9uZTtcbn1cblxuZnVuY3Rpb24gY2xlYXJQYWdlQnJha2VNYXJnaW5zKGVsZW1lbnQpe1xuICAgIGlmKGVsZW1lbnQubm9kZVR5cGUgIT09IDEpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYoZWxlbWVudC5oYXNBdHRyaWJ1dGUoJ2lzUHJpbnRTcGxpdEJyZWFrQmVmb3JlJykpe1xuICAgICAgICBlbGVtZW50LnN0eWxlLm1hcmdpblRvcCA9IEpTT04ucGFyc2UoZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2lzUHJpbnRTcGxpdEJyZWFrQmVmb3JlJykpO1xuICAgICAgICBlbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSgnaXNQcmludFNwbGl0QnJlYWtCZWZvcmUnKTtcbiAgICB9XG4gICAgaWYoZWxlbWVudC5oYXNBdHRyaWJ1dGUoJ2lzUHJpbnRTcGxpdEJyZWFrQWZ0ZXInKSl7XG4gICAgICAgIGVsZW1lbnQuc3R5bGUubWFyZ2luQm90dG9tID0gSlNPTi5wYXJzZShlbGVtZW50LmdldEF0dHJpYnV0ZSgnaXNQcmludFNwbGl0QnJlYWtBZnRlcicpKTtcbiAgICAgICAgZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoJ2lzUHJpbnRTcGxpdEJyZWFrQWZ0ZXInKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldEFkamFjZW50UGFnZUVsZW1lbnQocGFyZW50UGFnZSwgZWxlbWVudCwgZGlyZWN0aW9uKXtcbiAgICB2YXIgYWRqYWNlbnRQcm9wZXJ0eSA9IGRpcmVjdGlvbiA9PT0gJ3ByZXZpb3VzJyA/ICdwcmV2aW91c0VsZW1lbnRTaWJsaW5nJyA6ICduZXh0RWxlbWVudFNpYmxpbmcnO1xuICAgIHdoaWxlIChlbGVtZW50ICE9PSBwYXJlbnRQYWdlKXtcbiAgICAgICAgaWYoZWxlbWVudFthZGphY2VudFByb3BlcnR5XSl7XG4gICAgICAgICAgICByZXR1cm4gZWxlbWVudFthZGphY2VudFByb3BlcnR5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIGVsZW1lbnQgPSBlbGVtZW50LnBhcmVudEVsZW1lbnQ7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBmaXhUYWJsZSh0YWJsZSl7XG4gICAgaWYodGFibGUuZ2V0QXR0cmlidXRlKCdpc1ByaW50U3BsaXRGaXhlZCcpKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRhYmxlLnNldEF0dHJpYnV0ZSgnaXNQcmludFNwbGl0Rml4ZWQnLCAndHJ1ZScpO1xuXG4gICAgdmFyIHJvd3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0YWJsZS5xdWVyeVNlbGVjdG9yQWxsKCd0cicpKTtcblxuICAgIGlmKCFyb3dzLmxlbmd0aCl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgY29sdW1uV2lkdGhzID0gQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKHJvd3NbMF0ucXVlcnlTZWxlY3RvckFsbCgndGQsIHRoJyksIGZ1bmN0aW9uKGNlbGwpe1xuICAgICAgICByZXR1cm4gY2VsbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS53aWR0aCArIDEwO1xuICAgIH0pO1xuXG4gICAgdmFyIHRhYmxlV2lkdGggPSBjb2x1bW5XaWR0aHMucmVkdWNlKChhLCBiKSA9PiBhICsgYik7XG4gICAgdGFibGUuc3R5bGVbJ3RhYmxlLWxheW91dCddID0gJ2ZpeGVkJztcbiAgICB0YWJsZS5zdHlsZVsnd2lkdGgnXSA9IHRhYmxlV2lkdGggKyAncHgnO1xuXG4gICAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbChyb3dzLCBmdW5jdGlvbihyb3cpe1xuICAgICAgICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKHJvdy5xdWVyeVNlbGVjdG9yQWxsKCd0ZCwgdGgnKSwgZnVuY3Rpb24oY2VsbCwgaW5kZXgpe1xuICAgICAgICAgICAgY2VsbC5zdHlsZVsnd2lkdGgnXSA9ICgxMDAgLyB0YWJsZVdpZHRoICogY29sdW1uV2lkdGhzW2luZGV4XSkgKyAnJSc7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBwcmludGlmeShwYXJlbnRQYWdlLCB0YXJnZXQsIHJlY3QsIGhlaWdodCwgbWluU3BsaXRIZWlnaHQsIG5leHRTcGxpdFBhcmVudCwgbGFzdFBhZ2VPZmZzZXQsIG9wdGlvbnMpe1xuICAgIHZhciBwYWdlQm90dG9tID0gaGVpZ2h0ICsgbGFzdFBhZ2VPZmZzZXQ7XG5cbiAgICB2YXIgbmVlZHNOZXdSZWN0O1xuXG4gICAgdmFyIGNoaWxkUmVjdHMgPSBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKHRhcmdldC5jaGlsZE5vZGVzLCBmdW5jdGlvbihjaGlsZCl7XG4gICAgICAgIGlmKGNoaWxkLm5vZGVUeXBlID09PSAxICYmIG9wdGlvbnMuc2hvdWxkUGFnZUJyYWtlKXtcbiAgICAgICAgICAgIHZhciB0YXJnZXRTdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRhcmdldCk7XG4gICAgICAgICAgICB2YXIgcGFyZW50UGFkZGluZ0JvdHRvbSA9IHBhcnNlSW50KHRhcmdldFN0eWxlWydwYWRkaW5nLWJvdHRvbSddKTtcbiAgICAgICAgICAgIHZhciBpc1ByaW50U3BsaXRCcmVha0JlZm9yZSA9IGNoaWxkLmhhc0F0dHJpYnV0ZSgnaXNQcmludFNwbGl0QnJlYWtCZWZvcmUnKTtcblxuICAgICAgICAgICAgaWYoaXNQcmludFNwbGl0QnJlYWtCZWZvcmUpe1xuICAgICAgICAgICAgICAgIGNoaWxkLnN0eWxlLm1hcmdpblRvcCA9IEpTT04ucGFyc2UoY2hpbGQuZ2V0QXR0cmlidXRlKCdpc1ByaW50U3BsaXRCcmVha0JlZm9yZScpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGJyZWFrU2lkZSA9IG9wdGlvbnMuc2hvdWxkUGFnZUJyYWtlKGNoaWxkKTtcbiAgICAgICAgICAgIHZhciBjaGlsZFJlY3QgPSBnZXRSZWN0KGNoaWxkKTtcblxuICAgICAgICAgICAgaWYoYnJlYWtTaWRlICYmIGNoaWxkUmVjdC50b3AgPCByZWN0LmJvdHRvbSAmJiBjaGlsZFJlY3QudG9wIDwgcGFnZUJvdHRvbSl7XG4gICAgICAgICAgICAgICAgaWYoXG4gICAgICAgICAgICAgICAgICAgICFpc1ByaW50U3BsaXRCcmVha0JlZm9yZSAmJlxuICAgICAgICAgICAgICAgICAgICB+YnJlYWtTaWRlLmluZGV4T2YoJ2JlZm9yZScpICYmXG4gICAgICAgICAgICAgICAgICAgIGdldEFkamFjZW50UGFnZUVsZW1lbnQocGFyZW50UGFnZSwgY2hpbGQsICdwcmV2aW91cycpXG4gICAgICAgICAgICAgICAgKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1hcmdpbiA9IGhlaWdodCAtIChjaGlsZFJlY3QudG9wIC0gcmVjdC50b3ApO1xuICAgICAgICAgICAgICAgICAgICBjaGlsZC5zZXRBdHRyaWJ1dGUoJ2lzUHJpbnRTcGxpdEJyZWFrQmVmb3JlJywgSlNPTi5zdHJpbmdpZnkoY2hpbGQuc3R5bGUubWFyZ2luVG9wKSk7XG4gICAgICAgICAgICAgICAgICAgIGNoaWxkLnN0eWxlLm1hcmdpblRvcCA9IG1hcmdpbiArICdweCc7XG4gICAgICAgICAgICAgICAgICAgIG5lZWRzTmV3UmVjdCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmKFxuICAgICAgICAgICAgICAgICAgICB+YnJlYWtTaWRlLmluZGV4T2YoJ2FmdGVyJykgJiZcbiAgICAgICAgICAgICAgICAgICAgZ2V0QWRqYWNlbnRQYWdlRWxlbWVudChwYXJlbnRQYWdlLCBjaGlsZCwgJ25leHQnKVxuICAgICAgICAgICAgICAgICl7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtYXJnaW4gPSBoZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIGNoaWxkLnNldEF0dHJpYnV0ZSgnaXNQcmludFNwbGl0QnJlYWtBZnRlcicsIEpTT04uc3RyaW5naWZ5KGNoaWxkLnN0eWxlLm1hcmdpbkJvdHRvbSkpO1xuICAgICAgICAgICAgICAgICAgICBjaGlsZC5zdHlsZS5tYXJnaW5Cb3R0b20gPSBtYXJnaW4gKyAncHgnO1xuICAgICAgICAgICAgICAgICAgICBuZWVkc05ld1JlY3QgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sIFtdKTtcblxuICAgIGlmKG5lZWRzTmV3UmVjdCl7XG4gICAgICAgIHJlY3QgPSBnZXRSZWN0KHRhcmdldCk7XG4gICAgfVxuXG4gICAgaWYocmVjdC50b3AgPCBwYWdlQm90dG9tICYmIHJlY3QuYm90dG9tID4gcGFnZUJvdHRvbSl7XG4gICAgICAgIHZhciB0YXJnZXRTdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRhcmdldCk7XG4gICAgICAgIHZhciBwYXJlbnRQYWRkaW5nQm90dG9tID0gcGFyc2VJbnQodGFyZ2V0U3R5bGVbJ3BhZGRpbmctYm90dG9tJ10pO1xuICAgICAgICB2YXIgaW5uZXJIZWlnaHQgPSBoZWlnaHQgLSBwYXJlbnRQYWRkaW5nQm90dG9tO1xuICAgICAgICB2YXIgdGFyZ2V0UGFnZUJvdHRvbSA9IHBhZ2VCb3R0b20gLSBwYXJlbnRQYWRkaW5nQm90dG9tO1xuXG4gICAgICAgIGlmKHRhcmdldC5ub2RlTmFtZSA9PT0gJ1RBQkxFJyl7XG4gICAgICAgICAgICBmaXhUYWJsZSh0YXJnZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNsb25lID0gY3JlYXRlUHJpbnRDbG9uZSh0YXJnZXQpO1xuXG4gICAgICAgIC8vIEdldCBjaGlsZCBsb2NhdGlvbnNcbiAgICAgICAgdmFyIGNoaWxkUmVjdHMgPSBBcnJheS5wcm90b3R5cGUucmVkdWNlLmNhbGwodGFyZ2V0LmNoaWxkTm9kZXMsIGZ1bmN0aW9uKHJlc3VsdHMsIGNoaWxkKXtcbiAgICAgICAgICAgIHZhciBub2RlUmVjdCA9IGdldFJlY3QoY2hpbGQpO1xuXG4gICAgICAgICAgICBpZihub2RlUmVjdCl7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKFtjaGlsZCwgbm9kZVJlY3RdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgIH0sIFtdKTtcblxuICAgICAgICAvLyBDbGVhbnVwIHBhZ2UgYnJha2UgY2hpbGRyZW5cbiAgICAgICAgY2hpbGRSZWN0cy5mb3JFYWNoKGNoaWxkUmVjdEluZm8gPT4gY2xlYXJQYWdlQnJha2VNYXJnaW5zKGNoaWxkUmVjdEluZm9bMF0pKTtcblxuICAgICAgICAvLyBHZXQgY2hpbGRyZW4gdGhhdCBvdmVyZmxvdyB0aGUgcGFnZVxuICAgICAgICB2YXIgb2ZmUGFnZUNoaWxkUmVjdHMgPSBjaGlsZFJlY3RzLmZpbHRlcihmdW5jdGlvbihjaGlsZFJlY3RJbmZvKXtcbiAgICAgICAgICAgIHJldHVybiBjaGlsZFJlY3RJbmZvWzFdLmJvdHRvbSA+IHRhcmdldFBhZ2VCb3R0b207XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIERpc3Rpbmd1aXNoIGJldHdlZW4gY2hpbGRyZW4gY29tcGxldGVseSBvZmYgdGhlIHBhZ2UsIGFuZCBwYXJ0aWFsbHkgYWNyb3NzIHRoZSBwYWdlXG4gICAgICAgIHZhciBbIHNwbGl0UGFnZUNoaWxkUmVjdHMsIG5leHRQYWdlQ2hpbGRSZWN0cyBdID0gb2ZmUGFnZUNoaWxkUmVjdHMucmVkdWNlKGZ1bmN0aW9uKHBhZ2VzLCBjaGlsZFJlY3RJbmZvKXtcbiAgICAgICAgICAgIGlmKFxuICAgICAgICAgICAgICAgIGNoaWxkUmVjdEluZm9bMF0ubm9kZVR5cGUgPT09IDMgJiZcbiAgICAgICAgICAgICAgICBjaGlsZFJlY3RJbmZvWzFdLmhlaWdodCA+IG1pblNwbGl0SGVpZ2h0ICYmXG4gICAgICAgICAgICAgICAgY2hpbGRSZWN0SW5mb1sxXS50b3AgPCB0YXJnZXRQYWdlQm90dG9tXG4gICAgICAgICAgICApe1xuICAgICAgICAgICAgICAgIGlmKGNoaWxkUmVjdEluZm9bMV0uYm90dG9tIDwgdGFyZ2V0UGFnZUJvdHRvbSl7XG4gICAgICAgICAgICAgICAgICAgIHBhZ2VzWzBdLnB1c2goY2hpbGRSZWN0SW5mbyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwYWdlcztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgY2hpbGRUZXh0Tm9kZSA9IGNoaWxkUmVjdEluZm9bMF07XG4gICAgICAgICAgICAgICAgdmFyIHRleHROb2RlQ2xvbmUgPSBiYWxhbmNlVGV4dE5vZGUoY2hpbGRUZXh0Tm9kZSwgdGFyZ2V0UGFnZUJvdHRvbSk7XG5cbiAgICAgICAgICAgICAgICBjaGlsZFRleHROb2RlLnRleHRDb250ZW50ID0gY2hpbGRUZXh0Tm9kZS50ZXh0Q29udGVudC5zbGljZSh0ZXh0Tm9kZUNsb25lLnRleHRDb250ZW50Lmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgdGV4dFdyYXBwZXIuYXBwZW5kQ2hpbGQoY2hpbGRUZXh0Tm9kZSk7XG4gICAgICAgICAgICAgICAgdmFyIGNoaWxkUmVjdCA9IGdldFJlY3QodGV4dFdyYXBwZXIpO1xuICAgICAgICAgICAgICAgIHRleHRXcmFwcGVyLnJlcGxhY2VXaXRoKGNoaWxkVGV4dE5vZGUpO1xuXG4gICAgICAgICAgICAgICAgcGFnZXNbMV0ucHVzaChbY2hpbGRUZXh0Tm9kZSwgY2hpbGRSZWN0XSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhZ2VzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihcbiAgICAgICAgICAgICAgICBjaGlsZFJlY3RJbmZvWzFdLmhlaWdodCA8PSBtaW5TcGxpdEhlaWdodCB8fFxuICAgICAgICAgICAgICAgICFjaGlsZFJlY3RJbmZvWzBdLmhhc0NoaWxkTm9kZXMoKSAmJiBjaGlsZFJlY3RJbmZvWzFdLmhlaWdodCA8IGhlaWdodCB8fFxuICAgICAgICAgICAgICAgIGNoaWxkUmVjdEluZm9bMV0udG9wID4gdGFyZ2V0UGFnZUJvdHRvbVxuICAgICAgICAgICAgKXtcbiAgICAgICAgICAgICAgICBwYWdlc1sxXS5wdXNoKGNoaWxkUmVjdEluZm8pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwYWdlc1swXS5wdXNoKGNoaWxkUmVjdEluZm8pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcGFnZXM7XG4gICAgICAgIH0sIFtbXSwgW11dKTtcblxuICAgICAgICB2YXIgbmV4dFBhZ2VFbGVtZW50cyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgbmV4dFBhZ2VFbGVtZW50cy5hcHBlbmQuYXBwbHkobmV4dFBhZ2VFbGVtZW50cywgbmV4dFBhZ2VDaGlsZFJlY3RzLm1hcCh4ID0+IHhbMF0pKTtcblxuICAgICAgICBjbG9uZS5pbnNlcnRCZWZvcmUobmV4dFBhZ2VFbGVtZW50cywgY2xvbmUuZmlyc3RDaGlsZCk7XG5cbiAgICAgICAgaWYobmV4dFNwbGl0UGFyZW50KXtcbiAgICAgICAgICAgIHZhciBsYXN0SW5zZXJ0ZWRDbG9uZSA9IG5leHRTcGxpdFBhcmVudC5xdWVyeVNlbGVjdG9yKFwiW2lzUHJpbnRTcGxpdENsb25lXVwiKTtcbiAgICAgICAgICAgIG5leHRTcGxpdFBhcmVudC5pbnNlcnRCZWZvcmUoY2xvbmUsIGxhc3RJbnNlcnRlZENsb25lID8gbGFzdEluc2VydGVkQ2xvbmUubmV4dFNpYmxpbmcgOiBuZXh0U3BsaXRQYXJlbnQuZmlyc3RDaGlsZCk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdGFyZ2V0LnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKGNsb25lLCB0YXJnZXQubmV4dFNpYmxpbmcpO1xuICAgICAgICB9XG5cbiAgICAgICAgc3BsaXRQYWdlQ2hpbGRSZWN0cy5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkUmVjdEluZm8pe1xuICAgICAgICAgICAgcHJpbnRpZnkocGFyZW50UGFnZSwgY2hpbGRSZWN0SW5mb1swXSwgY2hpbGRSZWN0SW5mb1sxXSwgaW5uZXJIZWlnaHQsIG1pblNwbGl0SGVpZ2h0LCBjbG9uZSwgbGFzdFBhZ2VPZmZzZXQsIG9wdGlvbnMpO1xuICAgICAgICB9KTtcblxuICAgICAgICBpZighbmV4dFNwbGl0UGFyZW50KXtcbiAgICAgICAgICAgIHRhcmdldC5zdHlsZS5oZWlnaHQgPSBoZWlnaHQgKyAncHgnO1xuICAgICAgICAgICAgdmFyIHJlY3QgPSBnZXRSZWN0KGNsb25lKTtcblxuICAgICAgICAgICAgcmV0dXJuIFtjbG9uZSwgY2xvbmUsIHJlY3QsIGhlaWdodCwgbWluU3BsaXRIZWlnaHQsIG51bGwsIHJlY3QudG9wLCBvcHRpb25zXTtcbiAgICAgICAgfVxuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYoIW5leHRTcGxpdFBhcmVudCl7XG4gICAgICAgICAgICB0YXJnZXQuc3R5bGUuaGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4JztcbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YXJnZXQsIGhlaWdodCwgbWluU3BsaXRIZWlnaHQsIG9wdGlvbnMpe1xuICAgIHZhciBjbG9uZVN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICBjbG9uZVN0eWxlLnRleHRDb250ZW50ID0gJ1tpc1ByaW50U3BsaXRDbG9uZV17dmlzaWJpbGl0eTpoaWRkZW47fSc7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChjbG9uZVN0eWxlKTtcbiAgICB2YXIgdGFyZ2V0Q2xvbmUgPSBjcmVhdGVQcmludENsb25lKHRhcmdldCwgdHJ1ZSk7XG4gICAgdGFyZ2V0LnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKHRhcmdldENsb25lLCB0YXJnZXQpO1xuICAgIHRhcmdldENsb25lLm5vcm1hbGl6ZSgpO1xuICAgIHRhcmdldENsb25lLnN0eWxlLnRyYW5zZm9ybSA9ICdyb3RhdGVaKDApJztcbiAgICB2YXIgcmVjdCA9IGdldFJlY3QodGFyZ2V0Q2xvbmUpO1xuICAgIHZhciBwYWdlcyA9IFt0YXJnZXRDbG9uZV07XG5cbiAgICB2YXIgbmV4dCA9IFt0YXJnZXRDbG9uZSwgdGFyZ2V0Q2xvbmUsIHJlY3QsIGhlaWdodCwgbWluU3BsaXRIZWlnaHQsIG51bGwsIHJlY3QudG9wLCBvcHRpb25zXTtcblxuICAgIGRvIHtcbiAgICAgICAgbmV4dCA9IHByaW50aWZ5LmFwcGx5KG51bGwsIG5leHQpO1xuICAgICAgICBpZihuZXh0KXtcbiAgICAgICAgICAgIHBhZ2VzLnB1c2gobmV4dFswXSk7XG4gICAgICAgIH1cbiAgICB9IHdoaWxlKG5leHQpO1xuXG4gICAgQXJyYXkucHJvdG90eXBlLnNsaWNlLmFwcGx5KHRhcmdldC5xdWVyeVNlbGVjdG9yQWxsKCdbaXNQcmludFNwbGl0QnJlYWtdJykpLmZvckVhY2goZnVuY3Rpb24oZWxlbWVudCl7XG4gICAgICAgIGNsZWFyUGFnZUJyYWtlTWFyZ2lucyhlbGVtZW50KTtcbiAgICB9KTtcblxuICAgIHRhcmdldENsb25lLnN0eWxlLnRyYW5zZm9ybSA9IG51bGw7XG4gICAgY2xvbmVTdHlsZS5yZW1vdmUoKTtcbiAgICByZXR1cm4gcGFnZXM7XG59OyIsImZ1bmN0aW9uIGNoZWNrSWZQcm9taXNlKHByb21pc2Upe1xuICAgIGlmKCFwcm9taXNlIHx8IHR5cGVvZiBwcm9taXNlICE9PSAnb2JqZWN0JyB8fCB0eXBlb2YgcHJvbWlzZS50aGVuICE9PSAnZnVuY3Rpb24nKXtcbiAgICAgICAgdGhyb3cgXCJBYmJvdHQgcmVxdWlyZXMgYSBwcm9taXNlIHRvIGJyZWFrLiBJdCBpcyB0aGUgb25seSB0aGluZyBBYmJvdHQgaXMgZ29vZCBhdC5cIjtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYWJib3R0KHByb21pc2VPckZuKXtcbiAgICBpZih0eXBlb2YgcHJvbWlzZU9yRm4gIT09ICdmdW5jdGlvbicpe1xuICAgICAgICBjaGVja0lmUHJvbWlzZShwcm9taXNlT3JGbik7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKCl7XG4gICAgICAgIHZhciBwcm9taXNlO1xuICAgICAgICBpZih0eXBlb2YgcHJvbWlzZU9yRm4gPT09ICdmdW5jdGlvbicpe1xuICAgICAgICAgICBwcm9taXNlID0gcHJvbWlzZU9yRm4uYXBwbHkobnVsbCwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwLCAtMSkpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHByb21pc2UgPSBwcm9taXNlT3JGbjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNoZWNrSWZQcm9taXNlKHByb21pc2UpO1xuXG4gICAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3VtZW50c1thcmd1bWVudHMubGVuZ3RoLTFdO1xuICAgICAgICBwcm9taXNlLnRoZW4oY2FsbGJhY2suYmluZChudWxsLCBudWxsKSwgY2FsbGJhY2spO1xuICAgIH07XG59OyIsIi8vQ29weXJpZ2h0IChDKSAyMDEyIEtvcnkgTnVublxyXG5cclxuLy9QZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOlxyXG5cclxuLy9UaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cclxuXHJcbi8vVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXHJcblxyXG4vKlxyXG5cclxuICAgIFRoaXMgY29kZSBpcyBub3QgZm9ybWF0dGVkIGZvciByZWFkYWJpbGl0eSwgYnV0IHJhdGhlciBydW4tc3BlZWQgYW5kIHRvIGFzc2lzdCBjb21waWxlcnMuXHJcblxyXG4gICAgSG93ZXZlciwgdGhlIGNvZGUncyBpbnRlbnRpb24gc2hvdWxkIGJlIHRyYW5zcGFyZW50LlxyXG5cclxuICAgICoqKiBJRSBTVVBQT1JUICoqKlxyXG5cclxuICAgIElmIHlvdSByZXF1aXJlIHRoaXMgbGlicmFyeSB0byB3b3JrIGluIElFNywgYWRkIHRoZSBmb2xsb3dpbmcgYWZ0ZXIgZGVjbGFyaW5nIGNyZWwuXHJcblxyXG4gICAgdmFyIHRlc3REaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcclxuICAgICAgICB0ZXN0TGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsYWJlbCcpO1xyXG5cclxuICAgIHRlc3REaXYuc2V0QXR0cmlidXRlKCdjbGFzcycsICdhJyk7XHJcbiAgICB0ZXN0RGl2WydjbGFzc05hbWUnXSAhPT0gJ2EnID8gY3JlbC5hdHRyTWFwWydjbGFzcyddID0gJ2NsYXNzTmFtZSc6dW5kZWZpbmVkO1xyXG4gICAgdGVzdERpdi5zZXRBdHRyaWJ1dGUoJ25hbWUnLCdhJyk7XHJcbiAgICB0ZXN0RGl2WyduYW1lJ10gIT09ICdhJyA/IGNyZWwuYXR0ck1hcFsnbmFtZSddID0gZnVuY3Rpb24oZWxlbWVudCwgdmFsdWUpe1xyXG4gICAgICAgIGVsZW1lbnQuaWQgPSB2YWx1ZTtcclxuICAgIH06dW5kZWZpbmVkO1xyXG5cclxuXHJcbiAgICB0ZXN0TGFiZWwuc2V0QXR0cmlidXRlKCdmb3InLCAnYScpO1xyXG4gICAgdGVzdExhYmVsWydodG1sRm9yJ10gIT09ICdhJyA/IGNyZWwuYXR0ck1hcFsnZm9yJ10gPSAnaHRtbEZvcic6dW5kZWZpbmVkO1xyXG5cclxuXHJcblxyXG4qL1xyXG5cclxuKGZ1bmN0aW9uIChyb290LCBmYWN0b3J5KSB7XHJcbiAgICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCk7XHJcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xyXG4gICAgICAgIGRlZmluZShmYWN0b3J5KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcm9vdC5jcmVsID0gZmFjdG9yeSgpO1xyXG4gICAgfVxyXG59KHRoaXMsIGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBmbiA9ICdmdW5jdGlvbicsXHJcbiAgICAgICAgb2JqID0gJ29iamVjdCcsXHJcbiAgICAgICAgbm9kZVR5cGUgPSAnbm9kZVR5cGUnLFxyXG4gICAgICAgIHRleHRDb250ZW50ID0gJ3RleHRDb250ZW50JyxcclxuICAgICAgICBzZXRBdHRyaWJ1dGUgPSAnc2V0QXR0cmlidXRlJyxcclxuICAgICAgICBhdHRyTWFwU3RyaW5nID0gJ2F0dHJNYXAnLFxyXG4gICAgICAgIGlzTm9kZVN0cmluZyA9ICdpc05vZGUnLFxyXG4gICAgICAgIGlzRWxlbWVudFN0cmluZyA9ICdpc0VsZW1lbnQnLFxyXG4gICAgICAgIGQgPSB0eXBlb2YgZG9jdW1lbnQgPT09IG9iaiA/IGRvY3VtZW50IDoge30sXHJcbiAgICAgICAgaXNUeXBlID0gZnVuY3Rpb24oYSwgdHlwZSl7XHJcbiAgICAgICAgICAgIHJldHVybiB0eXBlb2YgYSA9PT0gdHlwZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzTm9kZSA9IHR5cGVvZiBOb2RlID09PSBmbiA/IGZ1bmN0aW9uIChvYmplY3QpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG9iamVjdCBpbnN0YW5jZW9mIE5vZGU7XHJcbiAgICAgICAgfSA6XHJcbiAgICAgICAgLy8gaW4gSUUgPD0gOCBOb2RlIGlzIGFuIG9iamVjdCwgb2J2aW91c2x5Li5cclxuICAgICAgICBmdW5jdGlvbihvYmplY3Qpe1xyXG4gICAgICAgICAgICByZXR1cm4gb2JqZWN0ICYmXHJcbiAgICAgICAgICAgICAgICBpc1R5cGUob2JqZWN0LCBvYmopICYmXHJcbiAgICAgICAgICAgICAgICAobm9kZVR5cGUgaW4gb2JqZWN0KSAmJlxyXG4gICAgICAgICAgICAgICAgaXNUeXBlKG9iamVjdC5vd25lckRvY3VtZW50LG9iaik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc0VsZW1lbnQgPSBmdW5jdGlvbiAob2JqZWN0KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjcmVsW2lzTm9kZVN0cmluZ10ob2JqZWN0KSAmJiBvYmplY3Rbbm9kZVR5cGVdID09PSAxO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaXNBcnJheSA9IGZ1bmN0aW9uKGEpe1xyXG4gICAgICAgICAgICByZXR1cm4gYSBpbnN0YW5jZW9mIEFycmF5O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXBwZW5kQ2hpbGQgPSBmdW5jdGlvbihlbGVtZW50LCBjaGlsZCkge1xyXG4gICAgICAgICAgICBpZiAoaXNBcnJheShjaGlsZCkpIHtcclxuICAgICAgICAgICAgICAgIGNoaWxkLm1hcChmdW5jdGlvbihzdWJDaGlsZCl7XHJcbiAgICAgICAgICAgICAgICAgICAgYXBwZW5kQ2hpbGQoZWxlbWVudCwgc3ViQ2hpbGQpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYoIWNyZWxbaXNOb2RlU3RyaW5nXShjaGlsZCkpe1xyXG4gICAgICAgICAgICAgICAgY2hpbGQgPSBkLmNyZWF0ZVRleHROb2RlKGNoaWxkKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbGVtZW50LmFwcGVuZENoaWxkKGNoaWxkKTtcclxuICAgICAgICB9O1xyXG5cclxuXHJcbiAgICBmdW5jdGlvbiBjcmVsKCl7XHJcbiAgICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsIC8vTm90ZTogYXNzaWduZWQgdG8gYSB2YXJpYWJsZSB0byBhc3Npc3QgY29tcGlsZXJzLiBTYXZlcyBhYm91dCA0MCBieXRlcyBpbiBjbG9zdXJlIGNvbXBpbGVyLiBIYXMgbmVnbGlnYWJsZSBlZmZlY3Qgb24gcGVyZm9ybWFuY2UuXHJcbiAgICAgICAgICAgIGVsZW1lbnQgPSBhcmdzWzBdLFxyXG4gICAgICAgICAgICBjaGlsZCxcclxuICAgICAgICAgICAgc2V0dGluZ3MgPSBhcmdzWzFdLFxyXG4gICAgICAgICAgICBjaGlsZEluZGV4ID0gMixcclxuICAgICAgICAgICAgYXJndW1lbnRzTGVuZ3RoID0gYXJncy5sZW5ndGgsXHJcbiAgICAgICAgICAgIGF0dHJpYnV0ZU1hcCA9IGNyZWxbYXR0ck1hcFN0cmluZ107XHJcblxyXG4gICAgICAgIGVsZW1lbnQgPSBjcmVsW2lzRWxlbWVudFN0cmluZ10oZWxlbWVudCkgPyBlbGVtZW50IDogZC5jcmVhdGVFbGVtZW50KGVsZW1lbnQpO1xyXG4gICAgICAgIC8vIHNob3J0Y3V0XHJcbiAgICAgICAgaWYoYXJndW1lbnRzTGVuZ3RoID09PSAxKXtcclxuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZighaXNUeXBlKHNldHRpbmdzLG9iaikgfHwgY3JlbFtpc05vZGVTdHJpbmddKHNldHRpbmdzKSB8fCBpc0FycmF5KHNldHRpbmdzKSkge1xyXG4gICAgICAgICAgICAtLWNoaWxkSW5kZXg7XHJcbiAgICAgICAgICAgIHNldHRpbmdzID0gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHNob3J0Y3V0IGlmIHRoZXJlIGlzIG9ubHkgb25lIGNoaWxkIHRoYXQgaXMgYSBzdHJpbmdcclxuICAgICAgICBpZigoYXJndW1lbnRzTGVuZ3RoIC0gY2hpbGRJbmRleCkgPT09IDEgJiYgaXNUeXBlKGFyZ3NbY2hpbGRJbmRleF0sICdzdHJpbmcnKSAmJiBlbGVtZW50W3RleHRDb250ZW50XSAhPT0gdW5kZWZpbmVkKXtcclxuICAgICAgICAgICAgZWxlbWVudFt0ZXh0Q29udGVudF0gPSBhcmdzW2NoaWxkSW5kZXhdO1xyXG4gICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICBmb3IoOyBjaGlsZEluZGV4IDwgYXJndW1lbnRzTGVuZ3RoOyArK2NoaWxkSW5kZXgpe1xyXG4gICAgICAgICAgICAgICAgY2hpbGQgPSBhcmdzW2NoaWxkSW5kZXhdO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmKGNoaWxkID09IG51bGwpe1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGlmIChpc0FycmF5KGNoaWxkKSkge1xyXG4gICAgICAgICAgICAgICAgICBmb3IgKHZhciBpPTA7IGkgPCBjaGlsZC5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFwcGVuZENoaWxkKGVsZW1lbnQsIGNoaWxkW2ldKTtcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgYXBwZW5kQ2hpbGQoZWxlbWVudCwgY2hpbGQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IodmFyIGtleSBpbiBzZXR0aW5ncyl7XHJcbiAgICAgICAgICAgIGlmKCFhdHRyaWJ1dGVNYXBba2V5XSl7XHJcbiAgICAgICAgICAgICAgICBpZihpc1R5cGUoc2V0dGluZ3Nba2V5XSxmbikpe1xyXG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnRba2V5XSA9IHNldHRpbmdzW2tleV07XHJcbiAgICAgICAgICAgICAgICB9ZWxzZXtcclxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50W3NldEF0dHJpYnV0ZV0oa2V5LCBzZXR0aW5nc1trZXldKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfWVsc2V7XHJcbiAgICAgICAgICAgICAgICB2YXIgYXR0ciA9IGF0dHJpYnV0ZU1hcFtrZXldO1xyXG4gICAgICAgICAgICAgICAgaWYodHlwZW9mIGF0dHIgPT09IGZuKXtcclxuICAgICAgICAgICAgICAgICAgICBhdHRyKGVsZW1lbnQsIHNldHRpbmdzW2tleV0pO1xyXG4gICAgICAgICAgICAgICAgfWVsc2V7XHJcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudFtzZXRBdHRyaWJ1dGVdKGF0dHIsIHNldHRpbmdzW2tleV0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gZWxlbWVudDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBVc2VkIGZvciBtYXBwaW5nIG9uZSBraW5kIG9mIGF0dHJpYnV0ZSB0byB0aGUgc3VwcG9ydGVkIHZlcnNpb24gb2YgdGhhdCBpbiBiYWQgYnJvd3NlcnMuXHJcbiAgICBjcmVsW2F0dHJNYXBTdHJpbmddID0ge307XHJcblxyXG4gICAgY3JlbFtpc0VsZW1lbnRTdHJpbmddID0gaXNFbGVtZW50O1xyXG5cclxuICAgIGNyZWxbaXNOb2RlU3RyaW5nXSA9IGlzTm9kZTtcclxuXHJcbiAgICBpZih0eXBlb2YgUHJveHkgIT09ICd1bmRlZmluZWQnKXtcclxuICAgICAgICBjcmVsLnByb3h5ID0gbmV3IFByb3h5KGNyZWwsIHtcclxuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbih0YXJnZXQsIGtleSl7XHJcbiAgICAgICAgICAgICAgICAhKGtleSBpbiBjcmVsKSAmJiAoY3JlbFtrZXldID0gY3JlbC5iaW5kKG51bGwsIGtleSkpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNyZWxba2V5XTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBjcmVsO1xyXG59KSk7XHJcbiIsInZhciBhYmJvdHQgPSByZXF1aXJlKCdhYmJvdHQnKTtcblxudmFyIGRlZmVyID0gZ2xvYmFsLnByb2Nlc3MgJiYgZ2xvYmFsLnByb2Nlc3MubmV4dFRpY2sgfHwgZ2xvYmFsLnNldEltbWVkaWF0ZSB8fCBnbG9iYWwuc2V0VGltZW91dDtcblxuZnVuY3Rpb24gaXNSaWdodG8oeCl7XG4gICAgcmV0dXJuIHR5cGVvZiB4ID09PSAnZnVuY3Rpb24nICYmICh4Ll9fcmVzb2x2ZV9fID09PSB4IHx8IHgucmVzb2x2ZSA9PT0geCk7XG59XG5cbmZ1bmN0aW9uIGlzVGhlbmFibGUoeCl7XG4gICAgcmV0dXJuIHggJiYgdHlwZW9mIHgudGhlbiA9PT0gJ2Z1bmN0aW9uJyAmJiAhaXNSaWdodG8oeCk7XG59XG5cbmZ1bmN0aW9uIGlzUmVzb2x2YWJsZSh4KXtcbiAgICByZXR1cm4gaXNSaWdodG8oeCkgfHwgaXNUaGVuYWJsZSh4KTtcbn1cblxuZnVuY3Rpb24gaXNUYWtlKHgpe1xuICAgIHJldHVybiB4ICYmIHR5cGVvZiB4ID09PSAnb2JqZWN0JyAmJiAnX190YWtlX18nIGluIHg7XG59XG5cbnZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsLmJpbmQoQXJyYXkucHJvdG90eXBlLnNsaWNlKTtcblxuZnVuY3Rpb24gZ2V0Q2FsbExpbmUoc3RhY2spe1xuICAgIHZhciBpbmRleCA9IDAsXG4gICAgICAgIGxpbmVzID0gc3RhY2suc3BsaXQoJ1xcbicpO1xuXG4gICAgd2hpbGUobGluZXNbKytpbmRleF0gJiYgbGluZXNbaW5kZXhdLm1hdGNoKC9yaWdodG9cXC9pbmRleFxcLmpzLykpe31cblxuICAgIHZhciBtYXRjaCA9IGxpbmVzW2luZGV4XSAmJiBsaW5lc1tpbmRleF0ubWF0Y2goL2F0ICguKikvKTtcblxuICAgIHJldHVybiBtYXRjaCA/IG1hdGNoWzFdIDogJyAtIE5vIHRyYWNlIC0gJztcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZURlcGVuZGVuY3kodGFzaywgZG9uZSl7XG4gICAgaWYoaXNUaGVuYWJsZSh0YXNrKSl7XG4gICAgICAgIHRhc2sgPSByaWdodG8oYWJib3R0KHRhc2spKTtcbiAgICB9XG5cbiAgICBpZihpc1JpZ2h0byh0YXNrKSl7XG4gICAgICAgIHJldHVybiB0YXNrKGZ1bmN0aW9uKGVycm9yKXtcbiAgICAgICAgICAgIHZhciByZXN1bHRzID0gc2xpY2UoYXJndW1lbnRzLCAxLCAyKTtcblxuICAgICAgICAgICAgaWYoIXJlc3VsdHMubGVuZ3RoKXtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2godW5kZWZpbmVkKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZG9uZShlcnJvciwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRha2UodGFyZ2V0VGFzayl7XG4gICAgICAgIHZhciBrZXlzID0gc2xpY2UoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgcmV0dXJuIHRhcmdldFRhc2soZnVuY3Rpb24oZXJyb3Ipe1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBzbGljZShhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgZG9uZShlcnJvciwga2V5cy5tYXAoZnVuY3Rpb24oa2V5KXtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXJnc1trZXldO1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBpZihcbiAgICAgICAgcmlnaHRvLl9kZWJ1ZyAmJlxuICAgICAgICByaWdodG8uX3dhcm5PblVuc3VwcG9ydGVkICYmXG4gICAgICAgIEFycmF5LmlzQXJyYXkodGFzaykgJiZcbiAgICAgICAgaXNSaWdodG8odGFza1swXSkgJiZcbiAgICAgICAgIWlzUmlnaHRvKHRhc2tbMV0pXG4gICAgKXtcblxuICAgICAgICBjb25zb2xlLndhcm4oJ1xcdTAwMWJbMzNtUG9zc2libGUgdW5zdXBwb3J0ZWQgdGFrZS9pZ25vcmUgc3ludGF4IGRldGVjdGVkOlxcdTAwMWJbMzltXFxuJyArIGdldENhbGxMaW5lKHRoaXMuX3N0YWNrKSk7XG4gICAgfVxuXG4gICAgaWYoaXNUYWtlKHRhc2spKXtcbiAgICAgICAgcmV0dXJuIHRha2UuYXBwbHkobnVsbCwgdGFzay5fX3Rha2VfXyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRvbmUobnVsbCwgW3Rhc2tdKTtcbn1cblxuZnVuY3Rpb24gdHJhY2VHZXQoaW5zdGFuY2UsIHJlc3VsdCl7XG4gICAgaWYocmlnaHRvLl9kZWJ1ZyAmJiAhKHR5cGVvZiByZXN1bHQgPT09ICdvYmplY3QnIHx8IHR5cGVvZiByZXN1bHQgPT09ICdmdW5jdGlvbicpKXtcbiAgICAgICAgdmFyIGxpbmUgPSBnZXRDYWxsTGluZShpbnN0YW5jZS5fc3RhY2spO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Jlc3VsdCBvZiByaWdodG8gd2FzIG5vdCBhbiBpbnN0YW5jZSBhdDogXFxuJyArIGxpbmUpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0KGZuKXtcbiAgICB2YXIgaW5zdGFuY2UgPSB0aGlzO1xuICAgIHJldHVybiByaWdodG8oZnVuY3Rpb24ocmVzdWx0LCBmbiwgZG9uZSl7XG4gICAgICAgIGlmKHR5cGVvZiBmbiA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGZuID09PSAnbnVtYmVyJyl7XG4gICAgICAgICAgICB0cmFjZUdldChpbnN0YW5jZSwgcmVzdWx0KTtcbiAgICAgICAgICAgIHJldHVybiBkb25lKG51bGwsIHJlc3VsdFtmbl0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmlnaHRvLmZyb20oZm4ocmVzdWx0KSkoZG9uZSk7XG4gICAgfSwgdGhpcywgZm4pO1xufVxuXG52YXIgbm9PcCA9IGZ1bmN0aW9uKCl7fTtcblxuZnVuY3Rpb24gcHJveHkoaW5zdGFuY2Upe1xuICAgIGluc3RhbmNlLl8gPSBuZXcgUHJveHkoaW5zdGFuY2UsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbih0YXJnZXQsIGtleSl7XG4gICAgICAgICAgICBpZihrZXkgPT09ICdfX3Jlc29sdmVfXycpe1xuICAgICAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZS5fO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihpbnN0YW5jZVtrZXldIHx8IGtleSBpbiBpbnN0YW5jZSB8fCBrZXkgPT09ICdpbnNwZWN0JyB8fCB0eXBlb2Yga2V5ID09PSAnc3ltYm9sJyl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlW2tleV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHJpZ2h0by5fZGVidWcgJiYga2V5LmNoYXJBdCgwKSA9PT0gJ18nKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5zdGFuY2Vba2V5XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHByb3h5KHJpZ2h0by5zeW5jKGZ1bmN0aW9uKHJlc3VsdCl7XG4gICAgICAgICAgICAgICAgdHJhY2VHZXQoaW5zdGFuY2UsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdFtrZXldO1xuICAgICAgICAgICAgfSwgaW5zdGFuY2UpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGluc3RhbmNlLl9fcmVzb2x2ZV9fID0gaW5zdGFuY2UuXztcbiAgICByZXR1cm4gaW5zdGFuY2UuXztcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUl0ZXJhdG9yKGZuKXtcbiAgICByZXR1cm4gZnVuY3Rpb24oKXtcbiAgICAgICAgdmFyIGFyZ3MgPSBzbGljZShhcmd1bWVudHMpLFxuICAgICAgICAgICAgY2FsbGJhY2sgPSBhcmdzLnBvcCgpLFxuICAgICAgICAgICAgZXJyb3JlZCxcbiAgICAgICAgICAgIGxhc3RWYWx1ZTtcblxuICAgICAgICBmdW5jdGlvbiByZWplY3QoZXJyb3Ipe1xuICAgICAgICAgICAgaWYoZXJyb3JlZCl7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZXJyb3JlZCA9IHRydWU7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZ2VuZXJhdG9yID0gZm4uYXBwbHkobnVsbCwgYXJncy5jb25jYXQocmVqZWN0KSk7XG5cbiAgICAgICAgZnVuY3Rpb24gcnVuKCl7XG4gICAgICAgICAgICBpZihlcnJvcmVkKXtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgbmV4dCA9IGdlbmVyYXRvci5uZXh0KGxhc3RWYWx1ZSk7XG4gICAgICAgICAgICBpZihuZXh0LmRvbmUpe1xuICAgICAgICAgICAgICAgIGlmKGVycm9yZWQpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsLCBuZXh0LnZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKGlzUmVzb2x2YWJsZShuZXh0LnZhbHVlKSl7XG4gICAgICAgICAgICAgICAgcmlnaHRvLnN5bmMoZnVuY3Rpb24odmFsdWUpe1xuICAgICAgICAgICAgICAgICAgICBsYXN0VmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgcnVuKCk7XG4gICAgICAgICAgICAgICAgfSwgbmV4dC52YWx1ZSkoZnVuY3Rpb24oZXJyb3Ipe1xuICAgICAgICAgICAgICAgICAgICBpZihlcnJvcil7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGFzdFZhbHVlID0gbmV4dC52YWx1ZTtcbiAgICAgICAgICAgIHJ1bigpO1xuICAgICAgICB9XG5cbiAgICAgICAgcnVuKCk7XG4gICAgfTtcbn1cblxuZnVuY3Rpb24gYWRkVHJhY2luZyhyZXNvbHZlLCBmbiwgYXJncyl7XG5cbiAgICB2YXIgYXJnTWF0Y2ggPSBmbi50b1N0cmluZygpLm1hdGNoKC9eW1xcd1xcc10qP1xcKCgoPzpcXHcrWyxcXHNdKj8pKilcXCkvKSxcbiAgICAgICAgYXJnTmFtZXMgPSBhcmdNYXRjaCA/IGFyZ01hdGNoWzFdLnNwbGl0KC9bLFxcc10rL2cpIDogW107XG5cbiAgICByZXNvbHZlLl9zdGFjayA9IG5ldyBFcnJvcigpLnN0YWNrO1xuICAgIHJlc29sdmUuX3RyYWNlID0gZnVuY3Rpb24odGFicyl7XG4gICAgICAgIHZhciBmaXJzdExpbmUgPSBnZXRDYWxsTGluZShyZXNvbHZlLl9zdGFjayk7XG5cbiAgICAgICAgaWYocmVzb2x2ZS5fZXJyb3Ipe1xuICAgICAgICAgICAgZmlyc3RMaW5lID0gJ1xcdTAwMWJbMzFtJyArIGZpcnN0TGluZSArICcgPC0gRVJST1IgU09VUkNFJyArICAnXFx1MDAxYlszOW0nO1xuICAgICAgICB9XG5cbiAgICAgICAgdGFicyA9IHRhYnMgfHwgMDtcbiAgICAgICAgdmFyIHNwYWNpbmcgPSAnICAgICc7XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCB0YWJzOyBpICsrKXtcbiAgICAgICAgICAgIHNwYWNpbmcgPSBzcGFjaW5nICsgJyAgICAnO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhcmdzLm1hcChmdW5jdGlvbihhcmcsIGluZGV4KXtcbiAgICAgICAgICAgIHJldHVybiBbYXJnLCBhcmdOYW1lc1tpbmRleF0gfHwgaW5kZXhdO1xuICAgICAgICB9KS5yZWR1Y2UoZnVuY3Rpb24ocmVzdWx0cywgYXJnSW5mbyl7XG4gICAgICAgICAgICB2YXIgYXJnID0gYXJnSW5mb1swXSxcbiAgICAgICAgICAgICAgICBhcmdOYW1lID0gYXJnSW5mb1sxXTtcblxuICAgICAgICAgICAgaWYoaXNUYWtlKGFyZykpe1xuICAgICAgICAgICAgICAgIGFyZyA9IGFyZy5fX3Rha2VfX1swXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYoaXNSaWdodG8oYXJnKSl7XG4gICAgICAgICAgICAgICAgdmFyIGxpbmUgPSBzcGFjaW5nICsgJy0gYXJndW1lbnQgXCInICsgYXJnTmFtZSArICdcIiBmcm9tICc7XG5cblxuICAgICAgICAgICAgICAgIGlmKCFhcmcuX3RyYWNlKXtcbiAgICAgICAgICAgICAgICAgICAgbGluZSA9IGxpbmUgKyAnVHJhY2luZyB3YXMgbm90IGVuYWJsZWQgZm9yIHRoaXMgcmlnaHRvIGluc3RhbmNlLic7XG4gICAgICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgICAgIGxpbmUgPSBsaW5lICsgYXJnLl90cmFjZSh0YWJzICsgMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChsaW5lKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgIH0sIFtmaXJzdExpbmVdKVxuICAgICAgICAuam9pbignXFxuJyk7XG4gICAgfTtcbn1cblxuZnVuY3Rpb24gdGFza0NvbXBsZXRlKGVycm9yKXtcbiAgICB2YXIgZG9uZSA9IHRoaXNbMF0sXG4gICAgICAgIGNvbnRleHQgPSB0aGlzWzFdLFxuICAgICAgICBjYWxsYmFja3MgPSBjb250ZXh0LmNhbGxiYWNrcztcblxuICAgIGlmKGVycm9yICYmIHJpZ2h0by5fZGVidWcpe1xuICAgICAgICBjb250ZXh0LnJlc29sdmUuX2Vycm9yID0gZXJyb3I7XG4gICAgfVxuXG4gICAgdmFyIHJlc3VsdHMgPSBhcmd1bWVudHM7XG5cbiAgICBkb25lKHJlc3VsdHMpO1xuXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGNhbGxiYWNrcy5sZW5ndGg7IGkrKyl7XG4gICAgICAgIGRlZmVyKGNhbGxiYWNrc1tpXS5hcHBseS5iaW5kKGNhbGxiYWNrc1tpXSwgbnVsbCwgcmVzdWx0cykpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZXJyb3JPdXQoZXJyb3IsIGNhbGxiYWNrKXtcbiAgICBpZihlcnJvciAmJiByaWdodG8uX2RlYnVnKXtcbiAgICAgICAgaWYocmlnaHRvLl9hdXRvdHJhY2VPbkVycm9yIHx8IHRoaXMucmVzb2x2ZS5fdHJhY2VPbkVycm9yKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdEZXBlbmRlbmN5IGVycm9yIGV4ZWN1dGluZyAnICsgdGhpcy5mbi5uYW1lICsgJyAnICsgdGhpcy5yZXNvbHZlLl90cmFjZSgpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNhbGxiYWNrKGVycm9yKTtcbn1cblxuZnVuY3Rpb24gZGVidWdSZXNvbHZlKGNvbnRleHQsIGFyZ3MsIGNvbXBsZXRlKXtcbiAgICB0cnl7XG4gICAgICAgIGFyZ3MucHVzaChjb21wbGV0ZSk7XG4gICAgICAgIGNvbnRleHQuZm4uYXBwbHkobnVsbCwgYXJncyk7XG4gICAgfWNhdGNoKGVycm9yKXtcbiAgICAgICAgY29uc29sZS5sb2coJ1Rhc2sgZXhjZXB0aW9uIGV4ZWN1dGluZyAnICsgY29udGV4dC5mbi5uYW1lICsgJyBmcm9tICcgKyBjb250ZXh0LnJlc29sdmUuX3RyYWNlKCkpO1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVXaXRoRGVwZW5kZW5jaWVzKGRvbmUsIGVycm9yLCBhcmdSZXN1bHRzKXtcbiAgICB2YXIgY29udGV4dCA9IHRoaXM7XG5cbiAgICBpZihlcnJvcil7XG4gICAgICAgIHZhciBib3VuZEVycm9yT3V0ID0gZXJyb3JPdXQuYmluZChjb250ZXh0LCBlcnJvcik7XG5cbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGNvbnRleHQuY2FsbGJhY2tzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIGJvdW5kRXJyb3JPdXQoY29udGV4dC5jYWxsYmFja3NbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBhcmdzID0gW10uY29uY2F0LmFwcGx5KFtdLCBhcmdSZXN1bHRzKSxcbiAgICAgICAgY29tcGxldGUgPSB0YXNrQ29tcGxldGUuYmluZChbZG9uZSwgY29udGV4dF0pO1xuXG4gICAgaWYocmlnaHRvLl9kZWJ1Zyl7XG4gICAgICAgIHJldHVybiBkZWJ1Z1Jlc29sdmUoY29udGV4dCwgYXJncywgY29tcGxldGUpO1xuICAgIH1cblxuICAgIC8vIFNsaWdodCBwZXJmIGJ1bXAgYnkgYXZvaWRpbmcgYXBwbHkgZm9yIHNpbXBsZSBjYXNlcy5cbiAgICBzd2l0Y2goYXJncy5sZW5ndGgpe1xuICAgICAgICBjYXNlIDA6IGNvbnRleHQuZm4oY29tcGxldGUpOyBicmVhaztcbiAgICAgICAgY2FzZSAxOiBjb250ZXh0LmZuKGFyZ3NbMF0sIGNvbXBsZXRlKTsgYnJlYWs7XG4gICAgICAgIGNhc2UgMjogY29udGV4dC5mbihhcmdzWzBdLCBhcmdzWzFdLCBjb21wbGV0ZSk7IGJyZWFrO1xuICAgICAgICBjYXNlIDM6IGNvbnRleHQuZm4oYXJnc1swXSwgYXJnc1sxXSwgYXJnc1syXSwgY29tcGxldGUpOyBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGFyZ3MucHVzaChjb21wbGV0ZSk7XG4gICAgICAgICAgICBjb250ZXh0LmZuLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVzb2x2ZURlcGVuZGVuY2llcyhhcmdzLCBjb21wbGV0ZSwgcmVzb2x2ZURlcGVuZGVuY3kpe1xuICAgIHZhciByZXN1bHRzID0gW10sXG4gICAgICAgIGRvbmUgPSAwLFxuICAgICAgICBoYXNFcnJvcmVkO1xuXG4gICAgaWYoIWFyZ3MubGVuZ3RoKXtcbiAgICAgICAgY29tcGxldGUobnVsbCwgW10pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRlcGVuZGVuY3lSZXNvbHZlZChpbmRleCwgZXJyb3IsIHJlc3VsdCl7XG4gICAgICAgIGlmKGhhc0Vycm9yZWQpe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoZXJyb3Ipe1xuICAgICAgICAgICAgaGFzRXJyb3JlZCA9IHRydWU7XG4gICAgICAgICAgICByZXR1cm4gY29tcGxldGUoZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0c1tpbmRleF0gPSByZXN1bHQ7XG5cbiAgICAgICAgaWYoKytkb25lID09PSBhcmdzLmxlbmd0aCl7XG4gICAgICAgICAgICBjb21wbGV0ZShudWxsLCByZXN1bHRzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgcmVzb2x2ZURlcGVuZGVuY3koYXJnc1tpXSwgZGVwZW5kZW5jeVJlc29sdmVkLmJpbmQobnVsbCwgaSkpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVzb2x2ZXIoY29tcGxldGUpe1xuICAgIHZhciBjb250ZXh0ID0gdGhpcztcblxuICAgIC8vIE5vIGNhbGxiYWNrPyBKdXN0IHJ1biB0aGUgdGFzay5cbiAgICBpZighYXJndW1lbnRzLmxlbmd0aCl7XG4gICAgICAgIGNvbXBsZXRlID0gbm9PcDtcbiAgICB9XG5cbiAgICBpZihpc1JpZ2h0byhjb21wbGV0ZSkpe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3JpZ2h0byBpbnN0YW5jZSBwYXNzZWQgaW50byBhIHJpZ2h0byBpbnN0YW5jZSBpbnN0ZWFkIG9mIGEgY2FsbGJhY2snKTtcbiAgICB9XG5cbiAgICBpZih0eXBlb2YgY29tcGxldGUgIT09ICdmdW5jdGlvbicpe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbGxiYWNrIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuICAgIH1cblxuICAgIGlmKGNvbnRleHQucmVzdWx0cyl7XG4gICAgICAgIHJldHVybiBjb21wbGV0ZS5hcHBseShudWxsLCBjb250ZXh0LnJlc3VsdHMpO1xuICAgIH1cblxuICAgIGNvbnRleHQuY2FsbGJhY2tzLnB1c2goY29tcGxldGUpO1xuXG4gICAgaWYoY29udGV4dC5zdGFydGVkKyspe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHJlc29sdmVkID0gcmVzb2x2ZVdpdGhEZXBlbmRlbmNpZXMuYmluZChjb250ZXh0LCBmdW5jdGlvbihyZXNvbHZlZFJlc3VsdHMpe1xuICAgICAgICAgICAgaWYocmlnaHRvLl9kZWJ1Zyl7XG4gICAgICAgICAgICAgICAgaWYocmlnaHRvLl9hdXRvdHJhY2UgfHwgY29udGV4dC5yZXNvbHZlLl90cmFjZU9uRXhlY3V0ZSl7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdFeGVjdXRpbmcgJyArIGNvbnRleHQuZm4ubmFtZSArICcgJyArIGNvbnRleHQucmVzb2x2ZS5fdHJhY2UoKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb250ZXh0LnJlc3VsdHMgPSByZXNvbHZlZFJlc3VsdHM7XG4gICAgICAgIH0pO1xuXG4gICAgZGVmZXIocmVzb2x2ZURlcGVuZGVuY2llcy5iaW5kKG51bGwsIGNvbnRleHQuYXJncywgcmVzb2x2ZWQsIHJlc29sdmVEZXBlbmRlbmN5LmJpbmQoY29udGV4dC5yZXNvbHZlKSkpO1xuXG4gICAgcmV0dXJuIGNvbnRleHQucmVzb2x2ZTtcbn07XG5cbmZ1bmN0aW9uIHJpZ2h0bygpe1xuICAgIHZhciBhcmdzID0gc2xpY2UoYXJndW1lbnRzKSxcbiAgICAgICAgZm4gPSBhcmdzLnNoaWZ0KCk7XG5cbiAgICBpZih0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIHRhc2sgZnVuY3Rpb24gcGFzc2VkIHRvIHJpZ2h0bycpO1xuICAgIH1cblxuICAgIGlmKGlzUmlnaHRvKGZuKSAmJiBhcmdzLmxlbmd0aCA+IDApe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JpZ2h0byB0YXNrIHBhc3NlZCBhcyB0YXJnZXQgdGFzayB0byByaWdodG8oKScpO1xuICAgIH1cblxuICAgIHZhciByZXNvbHZlckNvbnRleHQgPSB7XG4gICAgICAgICAgICBmbjogZm4sXG4gICAgICAgICAgICBjYWxsYmFja3M6IFtdLFxuICAgICAgICAgICAgYXJnczogYXJncyxcbiAgICAgICAgICAgIHN0YXJ0ZWQ6IDBcbiAgICAgICAgfSxcbiAgICAgICAgcmVzb2x2ZSA9IHJlc29sdmVyLmJpbmQocmVzb2x2ZXJDb250ZXh0KTtcbiAgICByZXNvbHZlLmdldCA9IGdldC5iaW5kKHJlc29sdmUpO1xuICAgIHJlc29sdmVyQ29udGV4dC5yZXNvbHZlID0gcmVzb2x2ZTtcbiAgICByZXNvbHZlLnJlc29sdmUgPSByZXNvbHZlO1xuXG4gICAgaWYocmlnaHRvLl9kZWJ1Zyl7XG4gICAgICAgIGFkZFRyYWNpbmcocmVzb2x2ZSwgZm4sIGFyZ3MpO1xuICAgIH1cblxuICAgIHJldHVybiByZXNvbHZlO1xufVxuXG5yaWdodG8uc3luYyA9IGZ1bmN0aW9uKGZuKXtcbiAgICByZXR1cm4gcmlnaHRvLmFwcGx5KG51bGwsIFtmdW5jdGlvbigpe1xuICAgICAgICB2YXIgYXJncyA9IHNsaWNlKGFyZ3VtZW50cyksXG4gICAgICAgICAgICBkb25lID0gYXJncy5wb3AoKSxcbiAgICAgICAgICAgIHJlc3VsdCA9IGZuLmFwcGx5KG51bGwsIGFyZ3MpO1xuXG4gICAgICAgIGlmKGlzUmVzb2x2YWJsZShyZXN1bHQpKXtcbiAgICAgICAgICAgIHJldHVybiByaWdodG8uZnJvbShyZXN1bHQpKGRvbmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgZG9uZShudWxsLCByZXN1bHQpO1xuICAgIH1dLmNvbmNhdChzbGljZShhcmd1bWVudHMsIDEpKSk7XG59O1xuXG5yaWdodG8uYWxsID0gZnVuY3Rpb24odmFsdWUpe1xuICAgIHZhciB0YXNrID0gdmFsdWU7XG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCA+IDEpe1xuICAgICAgICB0YXNrID0gc2xpY2UoYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZXNvbHZlKHRhc2tzKXtcbiAgICAgICAgcmV0dXJuIHJpZ2h0by5hcHBseShudWxsLCBbZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGFyZ3VtZW50c1thcmd1bWVudHMubGVuZ3RoIC0gMV0obnVsbCwgc2xpY2UoYXJndW1lbnRzLCAwLCAtMSkpO1xuICAgICAgICB9XS5jb25jYXQodGFza3MpKTtcbiAgICB9XG5cbiAgICBpZihpc1JpZ2h0byh0YXNrKSl7XG4gICAgICAgIHJldHVybiByaWdodG8oZnVuY3Rpb24odGFza3MsIGRvbmUpe1xuICAgICAgICAgICAgcmVzb2x2ZSh0YXNrcykoZG9uZSk7XG4gICAgICAgIH0sIHRhc2spO1xuICAgIH1cblxuICAgIHJldHVybiByZXNvbHZlKHRhc2spO1xufTtcblxucmlnaHRvLnJlZHVjZSA9IGZ1bmN0aW9uKHZhbHVlcywgcmVkdWNlciwgc2VlZCl7XG4gICAgdmFyIGhhc1NlZWQgPSBhcmd1bWVudHMubGVuZ3RoID49IDM7XG5cbiAgICBpZighcmVkdWNlcil7XG4gICAgICAgIHJlZHVjZXIgPSBmdW5jdGlvbihwcmV2aW91cywgbmV4dCl7XG4gICAgICAgICAgICByZXR1cm4gcmlnaHRvKG5leHQpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiByaWdodG8uZnJvbSh2YWx1ZXMpLmdldChmdW5jdGlvbih2YWx1ZXMpe1xuICAgICAgICBpZighdmFsdWVzIHx8ICF2YWx1ZXMucmVkdWNlKXtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigndmFsdWVzIHdhcyBub3QgYSByZWR1Y2VhYmxlIG9iamVjdCAobGlrZSBhbiBhcnJheSknKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKCF2YWx1ZXMubGVuZ3RoKXtcbiAgICAgICAgICAgIHJldHVybiByaWdodG8uZnJvbSh1bmRlZmluZWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFsdWVzID0gdmFsdWVzLnNsaWNlKCk7XG5cbiAgICAgICAgaWYoIWhhc1NlZWQpe1xuICAgICAgICAgICAgc2VlZCA9IHJpZ2h0byh2YWx1ZXMuc2hpZnQoKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdmFsdWVzLnJlZHVjZShmdW5jdGlvbihwcmV2aW91cywgbmV4dCl7XG4gICAgICAgICAgICByZXR1cm4gcmlnaHRvLnN5bmMocmVkdWNlciwgcHJldmlvdXMsIHJpZ2h0by52YWx1ZShuZXh0KSk7XG4gICAgICAgIH0sIHNlZWQpO1xuICAgIH0pO1xufTtcblxucmlnaHRvLmZyb20gPSBmdW5jdGlvbih2YWx1ZSl7XG4gICAgaWYoaXNSaWdodG8odmFsdWUpKXtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIGlmKCFpc1Jlc29sdmFibGUodmFsdWUpICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyl7XG4gICAgICAgIHJldHVybiByaWdodG8uYWxsKHNsaWNlKGFyZ3VtZW50cywgMSkpLmdldChmdW5jdGlvbihhcmdzKXtcbiAgICAgICAgICAgIHJldHVybiByaWdodG8uZnJvbSh2YWx1ZS5hcHBseShudWxsLCBhcmdzKSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiByaWdodG8uc3luYyhmdW5jdGlvbihyZXNvbHZlZCl7XG4gICAgICAgIHJldHVybiByZXNvbHZlZDtcbiAgICB9LCB2YWx1ZSk7XG59O1xuXG5yaWdodG8ubWF0ZSA9IGZ1bmN0aW9uKCl7XG4gICAgcmV0dXJuIHJpZ2h0by5hcHBseShudWxsLCBbZnVuY3Rpb24oKXtcbiAgICAgICAgYXJndW1lbnRzW2FyZ3VtZW50cy5sZW5ndGggLTFdLmFwcGx5KG51bGwsIFtudWxsXS5jb25jYXQoc2xpY2UoYXJndW1lbnRzLCAwLCAtMSkpKTtcbiAgICB9XS5jb25jYXQoc2xpY2UoYXJndW1lbnRzKSkpO1xufTtcblxucmlnaHRvLnRha2UgPSBmdW5jdGlvbih0YXNrKXtcbiAgICBpZighaXNSZXNvbHZhYmxlKHRhc2spKXtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd0YXNrIHdhcyBub3QgYSByZXNvbHZhYmxlIHZhbHVlJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtfX3Rha2VfXzogc2xpY2UoYXJndW1lbnRzKX07XG59O1xuXG5yaWdodG8uYWZ0ZXIgPSBmdW5jdGlvbih0YXNrKXtcbiAgICBpZighaXNSZXNvbHZhYmxlKHRhc2spKXtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd0YXNrIHdhcyBub3QgYSByZXNvbHZhYmxlIHZhbHVlJyk7XG4gICAgfVxuXG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSl7XG4gICAgICAgIHJldHVybiB7X190YWtlX186IFt0YXNrXX07XG4gICAgfVxuXG4gICAgcmV0dXJuIHtfX3Rha2VfXzogW3JpZ2h0by5tYXRlLmFwcGx5KG51bGwsIGFyZ3VtZW50cyldfTtcbn07XG5cbnJpZ2h0by5yZXNvbHZlID0gZnVuY3Rpb24ob2JqZWN0LCBkZWVwKXtcbiAgICBpZihpc1JpZ2h0byhvYmplY3QpKXtcbiAgICAgICAgcmV0dXJuIHJpZ2h0by5zeW5jKGZ1bmN0aW9uKG9iamVjdCl7XG4gICAgICAgICAgICByZXR1cm4gcmlnaHRvLnJlc29sdmUob2JqZWN0LCBkZWVwKTtcbiAgICAgICAgfSwgb2JqZWN0KTtcbiAgICB9XG5cbiAgICBpZighb2JqZWN0IHx8ICEodHlwZW9mIG9iamVjdCA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIG9iamVjdCA9PT0gJ2Z1bmN0aW9uJykpe1xuICAgICAgICByZXR1cm4gcmlnaHRvLmZyb20ob2JqZWN0KTtcbiAgICB9XG5cbiAgICB2YXIgcGFpcnMgPSByaWdodG8uYWxsKE9iamVjdC5rZXlzKG9iamVjdCkubWFwKGZ1bmN0aW9uKGtleSl7XG4gICAgICAgIHJldHVybiByaWdodG8oZnVuY3Rpb24odmFsdWUsIGRvbmUpe1xuICAgICAgICAgICAgaWYoZGVlcCl7XG4gICAgICAgICAgICAgICAgcmlnaHRvLnN5bmMoZnVuY3Rpb24odmFsdWUpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gW2tleSwgdmFsdWVdO1xuICAgICAgICAgICAgICAgIH0sIHJpZ2h0by5yZXNvbHZlKHZhbHVlLCB0cnVlKSkoZG9uZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZG9uZShudWxsLCBba2V5LCB2YWx1ZV0pO1xuICAgICAgICB9LCBvYmplY3Rba2V5XSk7XG4gICAgfSkpO1xuXG4gICAgcmV0dXJuIHJpZ2h0by5zeW5jKGZ1bmN0aW9uKHBhaXJzKXtcbiAgICAgICAgcmV0dXJuIHBhaXJzLnJlZHVjZShmdW5jdGlvbihyZXN1bHQsIHBhaXIpe1xuICAgICAgICAgICAgcmVzdWx0W3BhaXJbMF1dID0gcGFpclsxXTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0sIEFycmF5LmlzQXJyYXkob2JqZWN0KSA/IFtdIDoge30pO1xuICAgIH0sIHBhaXJzKTtcbn07XG5cbnJpZ2h0by5pdGVyYXRlID0gZnVuY3Rpb24oKXtcbiAgICB2YXIgYXJncyA9IHNsaWNlKGFyZ3VtZW50cyksXG4gICAgICAgIGZuID0gYXJncy5zaGlmdCgpO1xuXG4gICAgcmV0dXJuIHJpZ2h0by5hcHBseShudWxsLCBbcmVzb2x2ZUl0ZXJhdG9yKGZuKV0uY29uY2F0KGFyZ3MpKTtcbn07XG5cbnJpZ2h0by52YWx1ZSA9IGZ1bmN0aW9uKCl7XG4gICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgcmV0dXJuIHJpZ2h0byhmdW5jdGlvbihkb25lKXtcbiAgICAgICAgZG9uZS5hcHBseShudWxsLCBbbnVsbF0uY29uY2F0KHNsaWNlKGFyZ3MpKSk7XG4gICAgfSk7XG59O1xuXG5yaWdodG8uc3VyZWx5ID0gZnVuY3Rpb24odGFzayl7XG4gICAgaWYoIWlzUmVzb2x2YWJsZSh0YXNrKSl7XG4gICAgICAgIHRhc2sgPSByaWdodG8uYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmlnaHRvKGZ1bmN0aW9uKGRvbmUpe1xuICAgICAgICB0YXNrKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBkb25lKG51bGwsIHNsaWNlKGFyZ3VtZW50cykpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn07XG5cbnJpZ2h0by5oYW5kbGUgPSBmdW5jdGlvbih0YXNrLCBoYW5kbGVyKXtcbiAgICByZXR1cm4gcmlnaHRvKGZ1bmN0aW9uKGhhbmRsZXIsIGRvbmUpe1xuICAgICAgICB0YXNrKGZ1bmN0aW9uKGVycm9yKXtcbiAgICAgICAgICAgIGlmKCFlcnJvcil7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRhc2soZG9uZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGhhbmRsZXIoZXJyb3IsIGRvbmUpO1xuICAgICAgICB9KTtcbiAgICB9LCBoYW5kbGVyKTtcbn07XG5cbnJpZ2h0by5mYWlsID0gZnVuY3Rpb24oZXJyb3Ipe1xuICAgIHJldHVybiByaWdodG8oZnVuY3Rpb24oZXJyb3IsIGRvbmUpe1xuICAgICAgICBkb25lKGVycm9yKTtcbiAgICB9LCBlcnJvcik7XG59O1xuXG5yaWdodG8uZm9yayA9IGZ1bmN0aW9uKHZhbHVlKXtcbiAgICByZXR1cm4gZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgICAgcmlnaHRvLmZyb20odmFsdWUpKGZ1bmN0aW9uKGVycm9yLCByZXN1bHQpe1xuICAgICAgICAgICAgaWYoZXJyb3Ipe1xuICAgICAgICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgIH0pO1xuICAgIH07XG59O1xuXG5yaWdodG8uaXNSaWdodG8gPSBpc1JpZ2h0bztcbnJpZ2h0by5pc1RoZW5hYmxlID0gaXNUaGVuYWJsZTtcbnJpZ2h0by5pc1Jlc29sdmFibGUgPSBpc1Jlc29sdmFibGU7XG5cbnJpZ2h0by5wcm94eSA9IGZ1bmN0aW9uKCl7XG4gICAgaWYodHlwZW9mIFByb3h5ID09PSAndW5kZWZpbmVkJyl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhpcyBlbnZpcm9ubWVudCBkb2VzIG5vdCBzdXBwb3J0IFByb3h5XFwncycpO1xuICAgIH1cblxuICAgIHJldHVybiBwcm94eShyaWdodG8uYXBwbHkodGhpcywgYXJndW1lbnRzKSk7XG59O1xuXG5mb3IodmFyIGtleSBpbiByaWdodG8pe1xuICAgIHJpZ2h0by5wcm94eVtrZXldID0gcmlnaHRvW2tleV07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcmlnaHRvOyIsInZhciBzcGxpdHRlciA9IHJlcXVpcmUoJy4uLycpO1xudmFyIGNyZWwgPSByZXF1aXJlKCdjcmVsJyk7XG5cbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgZnVuY3Rpb24oKXtcblxuICAgIHZhciByb3dzID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgIHZhciBoZWFkZXJSb3cgPSBjcmVsKCd0cicsXG4gICAgICAgIGNyZWwoJ3RoJywgJ2NlbGwgMSAtIGhlYWRlciAnLCBpKSxcbiAgICAgICAgY3JlbCgndGgnLCAnY2VsbCAyIC0gaGVhZGVyJyksXG4gICAgICAgIGNyZWwoJ3RoJywgJ2NlbGwgMyAtIGhlYWRlcicpLFxuICAgICAgICBjcmVsKCd0aCcsICdjZWxsIDQgLSBoZWFkZXInKVxuICAgICk7XG4gICAgcm93cy5hcHBlbmRDaGlsZChoZWFkZXJSb3cpO1xuXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IDIwMDsgaSArKyl7XG4gICAgICAgIHZhciByb3cgPSBjcmVsKCd0cicsXG4gICAgICAgICAgICBjcmVsKCd0ZCcsICdjZWxsIDEgLSByb3cgJywgaSksXG4gICAgICAgICAgICBjcmVsKCd0ZCcsICdjZWxsIDInKSxcbiAgICAgICAgICAgIGNyZWwoJ3RkJywgJ2NlbGwgMycpLFxuICAgICAgICAgICAgY3JlbCgndGQnLCAnY2VsbCA0JylcbiAgICAgICAgKTtcbiAgICAgICAgcm93cy5hcHBlbmRDaGlsZChyb3cpO1xuICAgIH1cblxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5kYXRhJykuYXBwZW5kQ2hpbGQocm93cyk7XG5cbiAgICBmdW5jdGlvbiBwcmludCgpe1xuICAgICAgICB2YXIgcGFnZUVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcucGFnZScpO1xuICAgICAgICBwYWdlRWxlbWVudC5zdHlsZS53aWR0aCA9ICc3NzhweCc7XG5cbiAgICAgICAgdmFyIHBhZ2VzID0gc3BsaXR0ZXIocGFnZUVsZW1lbnQsIDEwODIsIDIwMCwge1xuICAgICAgICAgICAgc2hvdWxkUGFnZUJyYWtlOiBlbGVtZW50ID0+IChlbGVtZW50LmdldEF0dHJpYnV0ZSgncGFnZUJyZWFrJykgfHwgJycpLnNwbGl0KCcgJylcbiAgICAgICAgfSk7XG4gICAgICAgIHZhciBleGl0UHJpbnRWaWV3QnV0dG9uID0gY3JlbCgnYnV0dG9uJywgeyBjbGFzczogJ2V4aXRQcmludFZpZXcnIH0sICdDbG9zZSBwcmludCB2aWV3Jyk7XG4gICAgICAgIHZhciBwcmludFdyYXBwZXIgPSBjcmVsKCdkaXYnLCB7IGNsYXNzOiAncHJpbnRXcmFwcGVyJyB9LCBleGl0UHJpbnRWaWV3QnV0dG9uLCBwYWdlcyk7XG4gICAgICAgIGNyZWwoZG9jdW1lbnQuYm9keSwgcHJpbnRXcmFwcGVyKTtcbiAgICAgICAgcGFnZUVsZW1lbnQuc3R5bGUud2lkdGggPSBudWxsO1xuXG4gICAgICAgIGZ1bmN0aW9uIGV4aXRQcmludFZpZXcoKXtcbiAgICAgICAgICAgIHByaW50V3JhcHBlci5yZW1vdmUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGV4aXRQcmludFZpZXdCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBleGl0UHJpbnRWaWV3KTtcbiAgICB9XG5cbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdidXR0b24ucHJpbnQnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHByaW50KTtcbn0pOyJdfQ==
