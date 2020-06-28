const fs = require('fs');
const path = require('path');
const buttonHTML = fs.readFileSync(path.resolve(__dirname, 'injections', 'buttonHTML.html'), 'utf8');
const micromodalHTML = fs.readFileSync(path.resolve(__dirname, 'injections', 'micromodalHTML.html'), 'utf8');
const micromodalCSS = fs.readFileSync(path.resolve(__dirname, 'injections', 'micromodalCSS.css'), 'utf8');
const micromodalJS = fs.readFileSync(path.resolve(__dirname, 'injections', 'micromodalJS.js'), 'utf8');

const puppeteer = require('puppeteer');
const WIDTH = 1400;
const HEIGHT = 800;

(async (_) => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: [`--window-size=${WIDTH},${HEIGHT}`],
        //может понадобиться запустить whatsapp не в chromium
        //executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
    });

    //браузер запускается с уже открытой вкладкой и нет смысла открвать еще одну
    //page = await browser.newPage();

    const pages = await browser.pages();
    const page = pages[0];

    let simulationIsActiveCounter;
    await page.exposeFunction('setSimulationIsActive', (value) => {
        simulationIsActiveCounter = value ? 1 : 0;
        console.log(`${value ? 'START' : 'STOP'} simulation at ${new Date().toString()}`);
    });

    page.on('load', async (_) => {
        //жду пока появится список контактов и кликаю на первом
        let selector = '#pane-side > div:nth-child(1) > div > div > div:nth-child(1)';
        await page.waitForSelector(selector);
        await page.click(selector);

        //жду пока появятся кнопки напротив иконки пользователя
        selector = '#side > header > div:nth-child(2) > div > span';
        await page.waitForSelector(selector);
        //добавляю кнопку и модальное окно
        await page.evaluate(
            (micromodalCSS, micromodalHTML, micromodalJS, buttonHTML) => {
                const style = document.createElement('style');
                style.textContent = micromodalCSS;
                document.head.appendChild(style);

                const script = document.createElement('script');
                script.type = 'text/javascript';
                script.textContent = micromodalJS;
                document.head.appendChild(script);

                const modalElement = new DOMParser().parseFromString(micromodalHTML, 'text/html').body.childNodes[0];
                document.body.append(modalElement);

                const config = {
                    onShow: (_) => {
                        window.setSimulationIsActive(true);
                    },
                    onClose: (_) => {
                        window.setSimulationIsActive(false);
                    },
                };
                MicroModal.init();
                MicroModal.show('modal-1', config);

                const buttonElement = new DOMParser().parseFromString(buttonHTML, 'text/html').body.childNodes[0];
                const contElement = document.querySelector('#side > header > div:nth-child(2) > div > span');
                contElement.insertBefore(buttonElement, contElement.firstChild);
                buttonElement.addEventListener('click', (_) => {
                    MicroModal.show('modal-1', config);
                });

                let autoCloseFlag = false;
                //надо чтобы активность была только в рабочее время
                //TODO пока суббота и воскресенье включены
                setInterval((_) => {
                    const date = new Date();
                    const h = date.getHours();

                    if (h < 9 || h >= 18) {
                        if (!autoCloseFlag) {
                            MicroModal.close('modal-1');
                            autoCloseFlag = true;
                        }
                    } else {
                        if (autoCloseFlag) {
                            MicroModal.show('modal-1', config);
                            autoCloseFlag = false;
                        }
                    }
                }, 1000);
            },
            micromodalCSS,
            micromodalHTML,
            micromodalJS,
            buttonHTML
        );
    });

    await page.goto('https://web.whatsapp.com/');

    async function update() {
        if (simulationIsActiveCounter === 1) {
            try {
                //элемент по которому будет эмулироваться клик
                let selector = '#side > header > div:nth-child(1)';
                //жду пока появится элемент и кликаю по нему
                await page.waitForSelector(selector);
                await page.click(selector);

                simulationIsActiveCounter = (Math.floor(Math.random() * 10) + 2) * 60;
                console.log(`---pause ${simulationIsActiveCounter} sec.`);
            } catch (e) {}
        }

        simulationIsActiveCounter--;
    }
    setInterval(update, 1000);
})();
