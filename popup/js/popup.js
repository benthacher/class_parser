let resultElem;
let progressElem;
let preloaderElem;
let colorInputElem;
let timezoneSelector;

const Method = Object.freeze({
    ADD: 0,
    DELETE: 1
});

let currentMethod;

window.onload = async () => {
    resultElem = document.querySelector('#result');
    progressElem = document.querySelector('#progress');
    preloaderElem = document.querySelector('#preloader');
    colorInputElem = document.querySelector('#color-input');
    
    document.querySelector('#add-classes').onclick = () => injectParser(Method.ADD);
    document.querySelector('#remove-classes').onclick = () => injectParser(Method.DELETE);

    document.querySelector('#change-color').onclick = changeColor;

    const timezones = (await import('./timezones.js')).default;

    timezoneSelector = document.querySelector('#timezone-selector');

    const regions = {};

    timezones.forEach(tz => {
        const [ city ] = tz.utc;

        if (!city)
            return;

        const [ region ] = city.split('/');
        
        if (!(region in regions)) {
            const regionElem = document.createElement('optgroup');
            regionElem.label = region;

            timezoneSelector.appendChild(regionElem);
            regions[region] = regionElem;
        }

        let option = document.createElement('option');
        option.innerHTML = `${tz.value} (${tz.offset >= 0 ? `+${tz.offset}` : tz.offset})`;
        option.value = `${tz.offset};${city}`;

        regions[region].appendChild(option);
    });
}

const showPreloader = () => {
    preloaderElem.style.display = 'inline-block';
    resultElem.innerHTML = '';
};
const hidePreloader = () => preloaderElem.style.display = 'none';

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch (request.type) {
        case 'display-success':
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
        case 'get-class-timezone':
            sendResponse(timezoneSelector.value.split(';'));
            break;
        case 'get-method':
            sendResponse(currentMethod);
    }
});

function injectParser(method) {
    showPreloader();

    currentMethod = method;

    if (!timezoneSelector.value) {
        displayMessage('Error: Timezone cannot be blank', 'red');
        hidePreloader();
        return;
    }
    
    chrome.runtime.sendMessage({ type: 'inject-parser' });
}

function changeColor() {
    showPreloader();

    chrome.runtime.sendMessage({
        type: 'change-color',
        data: {
            color: colorInputElem.value,
            textColor: colorInputElem.style.color == 'rgb(0, 0, 0)' ? '#000000' : '#ffffff'
        }
    });
}

function displayMessage(message, color) {
    let pre = document.createElement('blockquote');
    pre.innerHTML = message;
    pre.classList.add(color + '-text', color + '-blockquote', 'log-text');

    resultElem.appendChild(pre);

    resultElem.scrollTop = resultElem.scrollHeight;
}
