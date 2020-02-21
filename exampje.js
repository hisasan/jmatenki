const jmatenki = require('./');

async function main() {
    try {
        const tenki = jmatenki();
        const forecast = await tenki.getWeather('奈良県', '北部');
        console.dir(forecast, {depth:null});
    } catch (e) {
        console.error(e);
    }
}

main();
