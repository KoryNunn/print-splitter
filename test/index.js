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