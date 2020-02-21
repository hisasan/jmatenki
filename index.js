'use strict';

const axios = require('axios');
const {JSDOM} = require('jsdom');
const _ = require('lodash');

const baseurl = 'http://www.jma.go.jp/jp/yoho/';

// 指定セレクタのtextContentを取得
function getTextContent(el, sel) {
    const value = el.querySelector(sel);
    return _.isElement(value) ? value.textContent.replace(/(\n|\t)/g, '') : null;
}

// 指定セレクタのtextContentを行ごとに分割して配列で取得
function getMultilineTextContent(el, sel) {
    const value = el.querySelector(sel);
    return _.isElement(value) ? value.textContent.split('\n').filter(el => _.size(el)) : null;
}

// 指定エレメントの1日の天気をオブジェクトで取得
function getDailyObject(day) {
    // 予報
    const forecast = getTextContent(day, '.info');
    // 時間毎の降水確率
    const rain = Array.from(day.querySelectorAll('table[class=\'rain\']>tbody>tr>td') || []).reduce((result, value, index, src) => {
        if ((index % 2) === 1) {
            const time    = src[index - 1].textContent.trim();
            const percent = value.textContent.trim();
            if (percent.match(/\d+%/)) {
                const last = _.last(result);
                if (percent === _.get(last, 'percent')) {
                    // 隣り合った時間の同じ降水確率をまとめる
                    last.time = last.time.slice(0, 3) + time.slice(-2);
                } else {
                    result.push({time, percent});
                }
            }
        }
        return result;
    }, []);
    // 気温
    let temp = {};
    ['min', 'max'].forEach(item => {
        const value = getTextContent(day, '.' + item);
        if (_.size(value)) {
            temp[item] = value;
        }
    });
    // オブジェクトにまとめて返す
    return {
        ... forecast ? {forecast} : {},
        ... _.size(rain) ? {rain} : {},
        ... _.size(temp) ? {temp} : {}
    };
}

// 指定したエリア（北部、南部など）のエレメントを3日分取得
function getDailyElementList(document, area) {
    const thlist = Array.from(document.querySelectorAll('.th-area') || []).filter(el => _.get(el, 'firstElementChild.textContent', null) === area);
    if (_.size(thlist) === 0) {
        throw Error(`Specified area "${area}" was not found`);
    }
    let day = _.get(thlist[0], 'parentElement.nextElementSibling', null);
    let daily = [];
    for (let i = 0; i < 3; i++) {
        if (_.isNull(day)) {
            throw Error(`Daily weather element of specified area "${area}" was not found`);
        }
        daily.push(day);
        day = day.nextElementSibling;
    }
    return daily;
}

// 指定したurlのdocumentを取得
async function getDocument(url) {
    let response = await axios.get(url);
    const {document} = (new JSDOM(response.data, {url:url})).window;
    return document;
}

// 指定した都道府県のIDを取得
async function getPrefectureID(prefecture) {
    const document = await getDocument(baseurl);
    const option = Array.from(document.querySelectorAll('select[name=\'elfukenlist\']>option') || []).filter(el => el.textContent === prefecture);
    if (_.size(option) === 0) {
        throw Error(`Specified prefecture "${prefecture}" was not found`);
    }
    return option[0].getAttribute('value');
}

// 公開オブジェクト
function jmatenki() {
    if (!(this instanceof jmatenki)) {
        return new jmatenki();
    }
}

// 指定した都道府県のエリア（北部、南部など）の天気をオブジェクトで取得
jmatenki.prototype.getWeather = async function(prefecture, area) {
    // 天気予報のページを取得
    const prefectureID = await getPrefectureID(prefecture);
    const document = await getDocument(baseurl + prefectureID + '.html');
    // 天気予報のキャプションを取得
    const caption = getTextContent(document, 'caption');
    // 天気概況を取得
    const overview = getMultilineTextContent(document, '.textframe');
    // 今日、明日、明後日の天気を取得
    const daily = getDailyElementList(document, area).reduce((result, el) => {
        const item = getDailyObject(el);
        if (_.size(item)) {
            result.push(item);
        }
        return result;
    }, []);
    // オブジェクトにまとめて返す
    return {
        prefecture,
        area,
        ... caption ? {caption} : {},
        ... overview ? {overview} : {},
        ... _.size(daily) ? {daily} : {}
    };
};

module.exports = jmatenki;
