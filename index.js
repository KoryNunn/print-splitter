var textWrapper = document.createElement('text-wrapper');
textWrapper.style.display = 'inline';

function printify(target, height, minSplitHeight, nextSplitParent, lastPageOffset){
    var pageBottom = height + lastPageOffset;
    var rect = target.getBoundingClientRect();

    if(rect.top < pageBottom && rect.bottom > pageBottom){
        var targetStyle = window.getComputedStyle(target);
        var parentPaddingBottom = parseInt(targetStyle['padding-bottom']);
        var innerHeight = height - parentPaddingBottom;
        var targetPageBottom = pageBottom - parentPaddingBottom;
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
            return childRectInfo[1].bottom > targetPageBottom;
        });

        var [ splitPageChildRects, nextPageChildRects ] = offPageChildRects.reduce(function(pages, childRectInfo){
            if(
                childRectInfo[0].nodeType === 3 &&
                childRectInfo[1].height > minSplitHeight &&
                childRectInfo[1].top < targetPageBottom
            ){
                var childTextNode = childRectInfo[0];
                var textNodeClone = childTextNode.cloneNode(true);
                childTextNode.parentElement.insertBefore(textWrapper, childTextNode);
                textWrapper.appendChild(textNodeClone);

                while(textNodeClone.textContent.length && textWrapper.getBoundingClientRect().bottom > targetPageBottom){
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
                childRectInfo[1].top > targetPageBottom
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
            printify(childRectInfo[0], innerHeight, minSplitHeight, clone, lastPageOffset);
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