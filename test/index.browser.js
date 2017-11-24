(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var textWrapper = document.createElement('text-wrapper');
textWrapper.style.display = 'inline';

function printify(target, height, minSplitHeight, nextSplitParent, lastPageOffset){
    var pageBottom = height + lastPageOffset;
    var rect = target.getBoundingClientRect();

    if(rect.top < pageBottom && rect.bottom > pageBottom){
        var clone = target.cloneNode();
        if(nextSplitParent){
            nextSplitParent.insertBefore(clone, nextSplitParent.firstChild);
        }else{
            target.parentElement.insertBefore(clone, target.nextSibling);
        }

        var childRects = Array.prototype.reduce.call(target.childNodes, function(results, child){
            if(child.nodeType === 3){
                child.replaceWith(textWrapper);
                textWrapper.appendChild(child);

                var childRect = textWrapper.getBoundingClientRect();
                textWrapper.replaceWith(child);
                results.push([child, childRect]);
            }

            if(child.nodeType === 1){
                results.push([child, child.getBoundingClientRect()]);
            }

            return results;
        }, []);

        var offPageChildRects = childRects.filter(function(childRectInfo){
            return childRectInfo[1].bottom > pageBottom;
        });

        var [ splitPageChildRects, nextPageChildRects ] = offPageChildRects.reduce(function(pages, childRectInfo){
            if(
                childRectInfo[0].nodeType === 3 &&
                childRectInfo[1].height > minSplitHeight &&
                childRectInfo[1].top < pageBottom
            ){
                var childTextNode = childRectInfo[0];
                var textNodeClone = childTextNode.cloneNode(true);
                childTextNode.parentElement.insertBefore(textWrapper, childTextNode);
                textWrapper.appendChild(textNodeClone);

                while(textNodeClone.textContent.length && textWrapper.getBoundingClientRect().bottom > pageBottom){
                    textNodeClone.textContent = textNodeClone.textContent.slice(0, -1);
                }

                textWrapper.replaceWith(textNodeClone);

                childTextNode.textContent = childTextNode.textContent.slice(textNodeClone.textContent.length);
                textWrapper.appendChild(childTextNode);
                var childRect = textWrapper.getBoundingClientRect();
                textWrapper.replaceWith(childTextNode);

                pages[1].push([childTextNode, childRect]);
                return pages;
            }

            if(
                childRectInfo[1].height <= minSplitHeight ||
                !childRectInfo[0].hasChildNodes() && childRectInfo[1].height < height ||
                childRectInfo[1].top > pageBottom
            ){
                pages[1].push(childRectInfo);
            } else {
                pages[0].push(childRectInfo);
            }

            return pages;
        }, [[], []]);

        nextPageChildRects.reverse().forEach(function(childRectInfo){
            clone.insertBefore(childRectInfo[0], clone.firstChild);
        });

        splitPageChildRects.forEach(function(childRectInfo){
            printify(childRectInfo[0], height, minSplitHeight, clone, lastPageOffset);
        });

        if(!nextSplitParent){
            target.style.height = height + 'px';
            printify(clone, height, minSplitHeight, null, clone.getBoundingClientRect().top);
        }
    }

    if(!nextSplitParent){
        target.style.height = height + 'px';
    }
}

module.exports = function(target, height, minSplitHeight){
    printify(target, height, minSplitHeight, null, target.getBoundingClientRect().top);
};
},{}],2:[function(require,module,exports){
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

},{}],3:[function(require,module,exports){
var splitter = require('../');
var crel = require('crel');

window.addEventListener('load', function(){

    var rows = document.createDocumentFragment();

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

    setTimeout(function(){
        var pageElement = document.querySelector('.page');
        pageElement.style.width = '778px';

        splitter(pageElement, 1102, 200);
    }, 1000);
});
},{"../":1,"crel":2}]},{},[3])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jcmVsL2NyZWwuanMiLCJ0ZXN0L2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIHRleHRXcmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGV4dC13cmFwcGVyJyk7XG50ZXh0V3JhcHBlci5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG5cbmZ1bmN0aW9uIHByaW50aWZ5KHRhcmdldCwgaGVpZ2h0LCBtaW5TcGxpdEhlaWdodCwgbmV4dFNwbGl0UGFyZW50LCBsYXN0UGFnZU9mZnNldCl7XG4gICAgdmFyIHBhZ2VCb3R0b20gPSBoZWlnaHQgKyBsYXN0UGFnZU9mZnNldDtcbiAgICB2YXIgcmVjdCA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuICAgIGlmKHJlY3QudG9wIDwgcGFnZUJvdHRvbSAmJiByZWN0LmJvdHRvbSA+IHBhZ2VCb3R0b20pe1xuICAgICAgICB2YXIgY2xvbmUgPSB0YXJnZXQuY2xvbmVOb2RlKCk7XG4gICAgICAgIGlmKG5leHRTcGxpdFBhcmVudCl7XG4gICAgICAgICAgICBuZXh0U3BsaXRQYXJlbnQuaW5zZXJ0QmVmb3JlKGNsb25lLCBuZXh0U3BsaXRQYXJlbnQuZmlyc3RDaGlsZCk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdGFyZ2V0LnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKGNsb25lLCB0YXJnZXQubmV4dFNpYmxpbmcpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNoaWxkUmVjdHMgPSBBcnJheS5wcm90b3R5cGUucmVkdWNlLmNhbGwodGFyZ2V0LmNoaWxkTm9kZXMsIGZ1bmN0aW9uKHJlc3VsdHMsIGNoaWxkKXtcbiAgICAgICAgICAgIGlmKGNoaWxkLm5vZGVUeXBlID09PSAzKXtcbiAgICAgICAgICAgICAgICBjaGlsZC5yZXBsYWNlV2l0aCh0ZXh0V3JhcHBlcik7XG4gICAgICAgICAgICAgICAgdGV4dFdyYXBwZXIuYXBwZW5kQ2hpbGQoY2hpbGQpO1xuXG4gICAgICAgICAgICAgICAgdmFyIGNoaWxkUmVjdCA9IHRleHRXcmFwcGVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICAgICAgICAgIHRleHRXcmFwcGVyLnJlcGxhY2VXaXRoKGNoaWxkKTtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goW2NoaWxkLCBjaGlsZFJlY3RdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYoY2hpbGQubm9kZVR5cGUgPT09IDEpe1xuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChbY2hpbGQsIGNoaWxkLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgICAgICB9LCBbXSk7XG5cbiAgICAgICAgdmFyIG9mZlBhZ2VDaGlsZFJlY3RzID0gY2hpbGRSZWN0cy5maWx0ZXIoZnVuY3Rpb24oY2hpbGRSZWN0SW5mbyl7XG4gICAgICAgICAgICByZXR1cm4gY2hpbGRSZWN0SW5mb1sxXS5ib3R0b20gPiBwYWdlQm90dG9tO1xuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgWyBzcGxpdFBhZ2VDaGlsZFJlY3RzLCBuZXh0UGFnZUNoaWxkUmVjdHMgXSA9IG9mZlBhZ2VDaGlsZFJlY3RzLnJlZHVjZShmdW5jdGlvbihwYWdlcywgY2hpbGRSZWN0SW5mbyl7XG4gICAgICAgICAgICBpZihcbiAgICAgICAgICAgICAgICBjaGlsZFJlY3RJbmZvWzBdLm5vZGVUeXBlID09PSAzICYmXG4gICAgICAgICAgICAgICAgY2hpbGRSZWN0SW5mb1sxXS5oZWlnaHQgPiBtaW5TcGxpdEhlaWdodCAmJlxuICAgICAgICAgICAgICAgIGNoaWxkUmVjdEluZm9bMV0udG9wIDwgcGFnZUJvdHRvbVxuICAgICAgICAgICAgKXtcbiAgICAgICAgICAgICAgICB2YXIgY2hpbGRUZXh0Tm9kZSA9IGNoaWxkUmVjdEluZm9bMF07XG4gICAgICAgICAgICAgICAgdmFyIHRleHROb2RlQ2xvbmUgPSBjaGlsZFRleHROb2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgICAgICBjaGlsZFRleHROb2RlLnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKHRleHRXcmFwcGVyLCBjaGlsZFRleHROb2RlKTtcbiAgICAgICAgICAgICAgICB0ZXh0V3JhcHBlci5hcHBlbmRDaGlsZCh0ZXh0Tm9kZUNsb25lKTtcblxuICAgICAgICAgICAgICAgIHdoaWxlKHRleHROb2RlQ2xvbmUudGV4dENvbnRlbnQubGVuZ3RoICYmIHRleHRXcmFwcGVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmJvdHRvbSA+IHBhZ2VCb3R0b20pe1xuICAgICAgICAgICAgICAgICAgICB0ZXh0Tm9kZUNsb25lLnRleHRDb250ZW50ID0gdGV4dE5vZGVDbG9uZS50ZXh0Q29udGVudC5zbGljZSgwLCAtMSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGV4dFdyYXBwZXIucmVwbGFjZVdpdGgodGV4dE5vZGVDbG9uZSk7XG5cbiAgICAgICAgICAgICAgICBjaGlsZFRleHROb2RlLnRleHRDb250ZW50ID0gY2hpbGRUZXh0Tm9kZS50ZXh0Q29udGVudC5zbGljZSh0ZXh0Tm9kZUNsb25lLnRleHRDb250ZW50Lmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgdGV4dFdyYXBwZXIuYXBwZW5kQ2hpbGQoY2hpbGRUZXh0Tm9kZSk7XG4gICAgICAgICAgICAgICAgdmFyIGNoaWxkUmVjdCA9IHRleHRXcmFwcGVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICAgICAgICAgIHRleHRXcmFwcGVyLnJlcGxhY2VXaXRoKGNoaWxkVGV4dE5vZGUpO1xuXG4gICAgICAgICAgICAgICAgcGFnZXNbMV0ucHVzaChbY2hpbGRUZXh0Tm9kZSwgY2hpbGRSZWN0XSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhZ2VzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihcbiAgICAgICAgICAgICAgICBjaGlsZFJlY3RJbmZvWzFdLmhlaWdodCA8PSBtaW5TcGxpdEhlaWdodCB8fFxuICAgICAgICAgICAgICAgICFjaGlsZFJlY3RJbmZvWzBdLmhhc0NoaWxkTm9kZXMoKSAmJiBjaGlsZFJlY3RJbmZvWzFdLmhlaWdodCA8IGhlaWdodCB8fFxuICAgICAgICAgICAgICAgIGNoaWxkUmVjdEluZm9bMV0udG9wID4gcGFnZUJvdHRvbVxuICAgICAgICAgICAgKXtcbiAgICAgICAgICAgICAgICBwYWdlc1sxXS5wdXNoKGNoaWxkUmVjdEluZm8pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwYWdlc1swXS5wdXNoKGNoaWxkUmVjdEluZm8pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcGFnZXM7XG4gICAgICAgIH0sIFtbXSwgW11dKTtcblxuICAgICAgICBuZXh0UGFnZUNoaWxkUmVjdHMucmV2ZXJzZSgpLmZvckVhY2goZnVuY3Rpb24oY2hpbGRSZWN0SW5mbyl7XG4gICAgICAgICAgICBjbG9uZS5pbnNlcnRCZWZvcmUoY2hpbGRSZWN0SW5mb1swXSwgY2xvbmUuZmlyc3RDaGlsZCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNwbGl0UGFnZUNoaWxkUmVjdHMuZm9yRWFjaChmdW5jdGlvbihjaGlsZFJlY3RJbmZvKXtcbiAgICAgICAgICAgIHByaW50aWZ5KGNoaWxkUmVjdEluZm9bMF0sIGhlaWdodCwgbWluU3BsaXRIZWlnaHQsIGNsb25lLCBsYXN0UGFnZU9mZnNldCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmKCFuZXh0U3BsaXRQYXJlbnQpe1xuICAgICAgICAgICAgdGFyZ2V0LnN0eWxlLmhlaWdodCA9IGhlaWdodCArICdweCc7XG4gICAgICAgICAgICBwcmludGlmeShjbG9uZSwgaGVpZ2h0LCBtaW5TcGxpdEhlaWdodCwgbnVsbCwgY2xvbmUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkudG9wKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmKCFuZXh0U3BsaXRQYXJlbnQpe1xuICAgICAgICB0YXJnZXQuc3R5bGUuaGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4JztcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFyZ2V0LCBoZWlnaHQsIG1pblNwbGl0SGVpZ2h0KXtcbiAgICBwcmludGlmeSh0YXJnZXQsIGhlaWdodCwgbWluU3BsaXRIZWlnaHQsIG51bGwsIHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS50b3ApO1xufTsiLCIvL0NvcHlyaWdodCAoQykgMjAxMiBLb3J5IE51bm5cclxuXHJcbi8vUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcclxuXHJcbi8vVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXHJcblxyXG4vL1RIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxyXG5cclxuLypcclxuXHJcbiAgICBUaGlzIGNvZGUgaXMgbm90IGZvcm1hdHRlZCBmb3IgcmVhZGFiaWxpdHksIGJ1dCByYXRoZXIgcnVuLXNwZWVkIGFuZCB0byBhc3Npc3QgY29tcGlsZXJzLlxyXG5cclxuICAgIEhvd2V2ZXIsIHRoZSBjb2RlJ3MgaW50ZW50aW9uIHNob3VsZCBiZSB0cmFuc3BhcmVudC5cclxuXHJcbiAgICAqKiogSUUgU1VQUE9SVCAqKipcclxuXHJcbiAgICBJZiB5b3UgcmVxdWlyZSB0aGlzIGxpYnJhcnkgdG8gd29yayBpbiBJRTcsIGFkZCB0aGUgZm9sbG93aW5nIGFmdGVyIGRlY2xhcmluZyBjcmVsLlxyXG5cclxuICAgIHZhciB0ZXN0RGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXHJcbiAgICAgICAgdGVzdExhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGFiZWwnKTtcclxuXHJcbiAgICB0ZXN0RGl2LnNldEF0dHJpYnV0ZSgnY2xhc3MnLCAnYScpO1xyXG4gICAgdGVzdERpdlsnY2xhc3NOYW1lJ10gIT09ICdhJyA/IGNyZWwuYXR0ck1hcFsnY2xhc3MnXSA9ICdjbGFzc05hbWUnOnVuZGVmaW5lZDtcclxuICAgIHRlc3REaXYuc2V0QXR0cmlidXRlKCduYW1lJywnYScpO1xyXG4gICAgdGVzdERpdlsnbmFtZSddICE9PSAnYScgPyBjcmVsLmF0dHJNYXBbJ25hbWUnXSA9IGZ1bmN0aW9uKGVsZW1lbnQsIHZhbHVlKXtcclxuICAgICAgICBlbGVtZW50LmlkID0gdmFsdWU7XHJcbiAgICB9OnVuZGVmaW5lZDtcclxuXHJcblxyXG4gICAgdGVzdExhYmVsLnNldEF0dHJpYnV0ZSgnZm9yJywgJ2EnKTtcclxuICAgIHRlc3RMYWJlbFsnaHRtbEZvciddICE9PSAnYScgPyBjcmVsLmF0dHJNYXBbJ2ZvciddID0gJ2h0bWxGb3InOnVuZGVmaW5lZDtcclxuXHJcblxyXG5cclxuKi9cclxuXHJcbihmdW5jdGlvbiAocm9vdCwgZmFjdG9yeSkge1xyXG4gICAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpO1xyXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcclxuICAgICAgICBkZWZpbmUoZmFjdG9yeSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJvb3QuY3JlbCA9IGZhY3RvcnkoKTtcclxuICAgIH1cclxufSh0aGlzLCBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgZm4gPSAnZnVuY3Rpb24nLFxyXG4gICAgICAgIG9iaiA9ICdvYmplY3QnLFxyXG4gICAgICAgIG5vZGVUeXBlID0gJ25vZGVUeXBlJyxcclxuICAgICAgICB0ZXh0Q29udGVudCA9ICd0ZXh0Q29udGVudCcsXHJcbiAgICAgICAgc2V0QXR0cmlidXRlID0gJ3NldEF0dHJpYnV0ZScsXHJcbiAgICAgICAgYXR0ck1hcFN0cmluZyA9ICdhdHRyTWFwJyxcclxuICAgICAgICBpc05vZGVTdHJpbmcgPSAnaXNOb2RlJyxcclxuICAgICAgICBpc0VsZW1lbnRTdHJpbmcgPSAnaXNFbGVtZW50JyxcclxuICAgICAgICBkID0gdHlwZW9mIGRvY3VtZW50ID09PSBvYmogPyBkb2N1bWVudCA6IHt9LFxyXG4gICAgICAgIGlzVHlwZSA9IGZ1bmN0aW9uKGEsIHR5cGUpe1xyXG4gICAgICAgICAgICByZXR1cm4gdHlwZW9mIGEgPT09IHR5cGU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc05vZGUgPSB0eXBlb2YgTm9kZSA9PT0gZm4gPyBmdW5jdGlvbiAob2JqZWN0KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBvYmplY3QgaW5zdGFuY2VvZiBOb2RlO1xyXG4gICAgICAgIH0gOlxyXG4gICAgICAgIC8vIGluIElFIDw9IDggTm9kZSBpcyBhbiBvYmplY3QsIG9idmlvdXNseS4uXHJcbiAgICAgICAgZnVuY3Rpb24ob2JqZWN0KXtcclxuICAgICAgICAgICAgcmV0dXJuIG9iamVjdCAmJlxyXG4gICAgICAgICAgICAgICAgaXNUeXBlKG9iamVjdCwgb2JqKSAmJlxyXG4gICAgICAgICAgICAgICAgKG5vZGVUeXBlIGluIG9iamVjdCkgJiZcclxuICAgICAgICAgICAgICAgIGlzVHlwZShvYmplY3Qub3duZXJEb2N1bWVudCxvYmopO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaXNFbGVtZW50ID0gZnVuY3Rpb24gKG9iamVjdCkge1xyXG4gICAgICAgICAgICByZXR1cm4gY3JlbFtpc05vZGVTdHJpbmddKG9iamVjdCkgJiYgb2JqZWN0W25vZGVUeXBlXSA9PT0gMTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzQXJyYXkgPSBmdW5jdGlvbihhKXtcclxuICAgICAgICAgICAgcmV0dXJuIGEgaW5zdGFuY2VvZiBBcnJheTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFwcGVuZENoaWxkID0gZnVuY3Rpb24oZWxlbWVudCwgY2hpbGQpIHtcclxuICAgICAgICAgICAgaWYgKGlzQXJyYXkoY2hpbGQpKSB7XHJcbiAgICAgICAgICAgICAgICBjaGlsZC5tYXAoZnVuY3Rpb24oc3ViQ2hpbGQpe1xyXG4gICAgICAgICAgICAgICAgICAgIGFwcGVuZENoaWxkKGVsZW1lbnQsIHN1YkNoaWxkKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmKCFjcmVsW2lzTm9kZVN0cmluZ10oY2hpbGQpKXtcclxuICAgICAgICAgICAgICAgIGNoaWxkID0gZC5jcmVhdGVUZXh0Tm9kZShjaGlsZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxlbWVudC5hcHBlbmRDaGlsZChjaGlsZCk7XHJcbiAgICAgICAgfTtcclxuXHJcblxyXG4gICAgZnVuY3Rpb24gY3JlbCgpe1xyXG4gICAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzLCAvL05vdGU6IGFzc2lnbmVkIHRvIGEgdmFyaWFibGUgdG8gYXNzaXN0IGNvbXBpbGVycy4gU2F2ZXMgYWJvdXQgNDAgYnl0ZXMgaW4gY2xvc3VyZSBjb21waWxlci4gSGFzIG5lZ2xpZ2FibGUgZWZmZWN0IG9uIHBlcmZvcm1hbmNlLlxyXG4gICAgICAgICAgICBlbGVtZW50ID0gYXJnc1swXSxcclxuICAgICAgICAgICAgY2hpbGQsXHJcbiAgICAgICAgICAgIHNldHRpbmdzID0gYXJnc1sxXSxcclxuICAgICAgICAgICAgY2hpbGRJbmRleCA9IDIsXHJcbiAgICAgICAgICAgIGFyZ3VtZW50c0xlbmd0aCA9IGFyZ3MubGVuZ3RoLFxyXG4gICAgICAgICAgICBhdHRyaWJ1dGVNYXAgPSBjcmVsW2F0dHJNYXBTdHJpbmddO1xyXG5cclxuICAgICAgICBlbGVtZW50ID0gY3JlbFtpc0VsZW1lbnRTdHJpbmddKGVsZW1lbnQpID8gZWxlbWVudCA6IGQuY3JlYXRlRWxlbWVudChlbGVtZW50KTtcclxuICAgICAgICAvLyBzaG9ydGN1dFxyXG4gICAgICAgIGlmKGFyZ3VtZW50c0xlbmd0aCA9PT0gMSl7XHJcbiAgICAgICAgICAgIHJldHVybiBlbGVtZW50O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoIWlzVHlwZShzZXR0aW5ncyxvYmopIHx8IGNyZWxbaXNOb2RlU3RyaW5nXShzZXR0aW5ncykgfHwgaXNBcnJheShzZXR0aW5ncykpIHtcclxuICAgICAgICAgICAgLS1jaGlsZEluZGV4O1xyXG4gICAgICAgICAgICBzZXR0aW5ncyA9IG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBzaG9ydGN1dCBpZiB0aGVyZSBpcyBvbmx5IG9uZSBjaGlsZCB0aGF0IGlzIGEgc3RyaW5nXHJcbiAgICAgICAgaWYoKGFyZ3VtZW50c0xlbmd0aCAtIGNoaWxkSW5kZXgpID09PSAxICYmIGlzVHlwZShhcmdzW2NoaWxkSW5kZXhdLCAnc3RyaW5nJykgJiYgZWxlbWVudFt0ZXh0Q29udGVudF0gIT09IHVuZGVmaW5lZCl7XHJcbiAgICAgICAgICAgIGVsZW1lbnRbdGV4dENvbnRlbnRdID0gYXJnc1tjaGlsZEluZGV4XTtcclxuICAgICAgICB9ZWxzZXtcclxuICAgICAgICAgICAgZm9yKDsgY2hpbGRJbmRleCA8IGFyZ3VtZW50c0xlbmd0aDsgKytjaGlsZEluZGV4KXtcclxuICAgICAgICAgICAgICAgIGNoaWxkID0gYXJnc1tjaGlsZEluZGV4XTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZihjaGlsZCA9PSBudWxsKXtcclxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoaXNBcnJheShjaGlsZCkpIHtcclxuICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaT0wOyBpIDwgY2hpbGQubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICBhcHBlbmRDaGlsZChlbGVtZW50LCBjaGlsZFtpXSk7XHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgIGFwcGVuZENoaWxkKGVsZW1lbnQsIGNoaWxkKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZm9yKHZhciBrZXkgaW4gc2V0dGluZ3Mpe1xyXG4gICAgICAgICAgICBpZighYXR0cmlidXRlTWFwW2tleV0pe1xyXG4gICAgICAgICAgICAgICAgaWYoaXNUeXBlKHNldHRpbmdzW2tleV0sZm4pKXtcclxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50W2tleV0gPSBzZXR0aW5nc1trZXldO1xyXG4gICAgICAgICAgICAgICAgfWVsc2V7XHJcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudFtzZXRBdHRyaWJ1dGVdKGtleSwgc2V0dGluZ3Nba2V5XSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICAgICAgdmFyIGF0dHIgPSBhdHRyaWJ1dGVNYXBba2V5XTtcclxuICAgICAgICAgICAgICAgIGlmKHR5cGVvZiBhdHRyID09PSBmbil7XHJcbiAgICAgICAgICAgICAgICAgICAgYXR0cihlbGVtZW50LCBzZXR0aW5nc1trZXldKTtcclxuICAgICAgICAgICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnRbc2V0QXR0cmlidXRlXShhdHRyLCBzZXR0aW5nc1trZXldKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGVsZW1lbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gVXNlZCBmb3IgbWFwcGluZyBvbmUga2luZCBvZiBhdHRyaWJ1dGUgdG8gdGhlIHN1cHBvcnRlZCB2ZXJzaW9uIG9mIHRoYXQgaW4gYmFkIGJyb3dzZXJzLlxyXG4gICAgY3JlbFthdHRyTWFwU3RyaW5nXSA9IHt9O1xyXG5cclxuICAgIGNyZWxbaXNFbGVtZW50U3RyaW5nXSA9IGlzRWxlbWVudDtcclxuXHJcbiAgICBjcmVsW2lzTm9kZVN0cmluZ10gPSBpc05vZGU7XHJcblxyXG4gICAgaWYodHlwZW9mIFByb3h5ICE9PSAndW5kZWZpbmVkJyl7XHJcbiAgICAgICAgY3JlbC5wcm94eSA9IG5ldyBQcm94eShjcmVsLCB7XHJcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24odGFyZ2V0LCBrZXkpe1xyXG4gICAgICAgICAgICAgICAgIShrZXkgaW4gY3JlbCkgJiYgKGNyZWxba2V5XSA9IGNyZWwuYmluZChudWxsLCBrZXkpKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBjcmVsW2tleV07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gY3JlbDtcclxufSkpO1xyXG4iLCJ2YXIgc3BsaXR0ZXIgPSByZXF1aXJlKCcuLi8nKTtcbnZhciBjcmVsID0gcmVxdWlyZSgnY3JlbCcpO1xuXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uKCl7XG5cbiAgICB2YXIgcm93cyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCAyMDA7IGkgKyspe1xuICAgICAgICB2YXIgcm93ID0gY3JlbCgndHInLFxuICAgICAgICAgICAgY3JlbCgndGQnLCAnY2VsbCAxIC0gcm93ICcsIGkpLFxuICAgICAgICAgICAgY3JlbCgndGQnLCAnY2VsbCAyJyksXG4gICAgICAgICAgICBjcmVsKCd0ZCcsICdjZWxsIDMnKSxcbiAgICAgICAgICAgIGNyZWwoJ3RkJywgJ2NlbGwgNCcpXG4gICAgICAgICk7XG4gICAgICAgIHJvd3MuYXBwZW5kQ2hpbGQocm93KTtcbiAgICB9XG5cbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuZGF0YScpLmFwcGVuZENoaWxkKHJvd3MpO1xuXG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgICB2YXIgcGFnZUVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcucGFnZScpO1xuICAgICAgICBwYWdlRWxlbWVudC5zdHlsZS53aWR0aCA9ICc3NzhweCc7XG5cbiAgICAgICAgc3BsaXR0ZXIocGFnZUVsZW1lbnQsIDExMDIsIDIwMCk7XG4gICAgfSwgMTAwMCk7XG59KTsiXX0=
