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