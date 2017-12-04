# print-splitter

Splits up a DOM node into a set of pages for printing

# Why

Printing DOM Sucks, page breaks don't work half the time
print-splitter chunks a target DOM node into page-sized bits.

# Example

https://korynunn.github.io/print-splitter/test/

# Usage

```javascript

    var splitter = require('print-splitter');

    var pageHeight = 1102; // "paper" height, 1082px is around A4 height.
    var minimumSplitHight = 200; // Don't split elements smaller than 200px, push them to the next page.

    var pages = splitter(document.querySelector('.page'), pageHeight, minimumSplitHight);

    // `pages` will be in the DOM before the targeted node.

```
