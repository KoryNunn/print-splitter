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

function printify(target, rect, height, minSplitHeight, nextSplitParent, lastPageOffset){
    var pageBottom = height + lastPageOffset;

    if(rect.top < pageBottom && rect.bottom > pageBottom){
        var targetStyle = window.getComputedStyle(target);
        var parentPaddingBottom = parseInt(targetStyle['padding-bottom']);
        var innerHeight = height - parentPaddingBottom;
        var targetPageBottom = pageBottom - parentPaddingBottom;
        var clone = createPrintClone(target);

        var childRects = Array.prototype.reduce.call(target.childNodes, function(results, child){
            var nodeRect = getRect(child);

            if(nodeRect){
                results.push([child, nodeRect]);
            }

            return results;
        }, []);

        var offPageChildRects = childRects.filter(function(childRectInfo){
            return childRectInfo[1].bottom > targetPageBottom;
        });

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
            printify(childRectInfo[0], childRectInfo[1], innerHeight, minSplitHeight, clone, lastPageOffset);
        });

        if(!nextSplitParent){
            target.style.height = height + 'px';
            var rect = getRect(clone);

            return [clone, rect, height, minSplitHeight, null, rect.top];
        }

    } else {
        if(!nextSplitParent){
            target.style.height = height + 'px';
        }
    }
}

module.exports = function(target, height, minSplitHeight){
    var cloneStyle = document.createElement('style');
    cloneStyle.textContent = '[isPrintSplitClone]{visibility:hidden;}';
    document.body.appendChild(cloneStyle);
    var targetClone = createPrintClone(target, true);
    target.parentElement.insertBefore(targetClone, target);
    targetClone.normalize();
    targetClone.style.transform = 'rotateZ(0)';
    var rect = getRect(targetClone);
    var pages = [targetClone];

    var next = [targetClone, rect, height, minSplitHeight, null, rect.top];

    do {
        next = printify.apply(null, next);
        if(next){
            pages.push(next[0]);
        }
    } while(next);

    targetClone.style.transform = null;
    cloneStyle.remove();
    return pages;
};