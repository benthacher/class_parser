let resultElem;
let progressElem;
let preloaderElem;

window.onload = () => {
    resultElem = document.querySelector('#result');
    progressElem = document.querySelector('#progress');
    preloaderElem = document.querySelector('#preloader');
    
    document.querySelector('#add-classes').onclick = injectParser;
}

const showPreloader = () => preloaderElem.style.display = 'inline-block';
const hidePreloader = () => preloaderElem.style.display = 'none';

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch (request.type) {
        case 'display-success':
            showPreloader();
            displayMessage(request.data, 'green');
            break;
        case 'display-error':
            hidePreloader();
            displayMessage('Error: ' + request.data, 'red');
            break;
        case 'completeness-fraction':
            const percent = Math.ceil(request.data * 100);
            progressElem.style.width = `${percent}%`;
            
            if (percent == 100) {
                hidePreloader();
                displayMessage('Done!', 'green');
            }
                
            break;
    }
});

function injectParser() {
    showPreloader();
    
    chrome.runtime.sendMessage({ type: 'inject-parser' });
}

function displayMessage(message, color) {
    let pre = document.createElement('blockquote');
    pre.innerHTML = message;
    pre.classList.add(color + '-text', color + '-blockquote', 'log-text');

    resultElem.appendChild(pre);

    resultElem.scrollTop = resultElem.scrollHeight;
}