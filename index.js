const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
require('dotenv').config();

const coordinatesApiUrl = 'http://api.open-notify.org/iss-now.json';
const locationInfoByCoordinatesApiBaseUrl = 'https://nominatim.openstreetmap.org/reverse';

const bot = new TelegramBot(process.env.TELEGRAM_API_TOKEN);

const getLocationInfoByCoordinatesUrl = ({ longitude, latitude }) => {
    const locationInfoByCoordinatesUrl = new URL(locationInfoByCoordinatesApiBaseUrl);
    locationInfoByCoordinatesUrl.searchParams.set('lon', longitude);
    locationInfoByCoordinatesUrl.searchParams.set('lat', latitude);
    locationInfoByCoordinatesUrl.searchParams.set('format', 'json');
    locationInfoByCoordinatesUrl.searchParams.set('accept-language', 'en-US');
    return locationInfoByCoordinatesUrl;
}

const sendMessage = (msg) => {
    console.log(`Trying to send the message: "${msg}".`);
    bot
        .sendMessage(process.env.TELEGRAM_CHAT_ID, msg)
        .catch(err => console.error(`Failed to send message;`, err));
}

const main = async (shouldSendIncompleteData = false) => {
    let issPosition;
    let answerString = 'Failed to get the information due to some error. Sorry :(';
    try {
        let message;
        const issCoordinatesRowResponse = await fetch(coordinatesApiUrl.toString());
        ({ iss_position: issPosition, message } = await issCoordinatesRowResponse.json());
        if (message !== 'success') {
            throw new Error(`API returned message ${message}`);
        }
        answerString = `ISS is now at longitude ${
            issPosition.longitude
        } and latitude ${
            issPosition.latitude
        }. Failed to get any information on the country below.`;
    } catch (err) {
        console.error(`Failed to get ISS coordinates;`, err);
        shouldSendIncompleteData && sendMessage(answerString);
        return;
    }
    
    try {
        const locationInfoByCoordinatesApiUrl = getLocationInfoByCoordinatesUrl(issPosition);
        const issLocationInfoRowResponse = await fetch(locationInfoByCoordinatesApiUrl.toString());
        const { address, error } = await issLocationInfoRowResponse.json();
        if (error || !address) {
            throw new Error(error || `unknown error in response`);
        }
        const { country, state, region } = address;

        const moreInfo = state && region
            ? `'s state ${state}, region ${region}`
            : state
                ? `'s state ${state}`
                : region
                    ? `'s region ${region}`
                    : '';

        answerString = `ISS is now at longitude ${
            issPosition.longitude
        } and latitude ${
            issPosition.latitude
        } over country ${country}${moreInfo}.`;
    } catch (err) {
        console.error(`Failed to get ISS location info for position ${
            JSON.stringify(issPosition)
        }${
            shouldSendIncompleteData
                ? ', will just send basic information'
                : ''
        };`, err);
        if (!shouldSendIncompleteData) return;
    }

    sendMessage(answerString);
}

main(true);