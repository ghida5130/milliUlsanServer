const cron = require("node-cron");
require("dotenv").config();
const path = require("path");
const axios = require("axios");
const fs = require("fs");

// 모든 시간을 기준 시간으로 변경함 (2,5,8,11,14,17,20,23)
function groupByThreeHours(hours) {
    if (hours === 0 || hours === 1 || hours === 23) {
        return 23;
    }
    return Math.floor((hours + 1) / 3) * 3 - 1;
}

const fetchWeatherData = async () => {
    // API 호출을 위한 날짜 및 시간 변수
    const time = new Date();
    const year = time.getFullYear().toString();
    const month = (time.getMonth() + 1).toString().padStart(2, "0");
    const day = time.getDate().toString().padStart(2, "0");
    const hour = time.getHours();
    const convertedHour = groupByThreeHours(hour).toString().padStart(2, "0");
    const nowDate = year + month + day;

    try {
        const response = await axios.get(
            `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${process.env.OPEN_DATA_API_KEY}&numOfRows=1000&pageNo=1&base_date=${nowDate}&base_time=${convertedHour}00&nx=102&ny=86&dataType=JSON`
        );
        response.data.response.body.items.item = response.data.response.body.items.item.filter(
            (i) => i.category === "TMP" || i.category === "PTY" || i.category === "POP"
        );

        // json 파일을 캐싱(저장) 하기위한 경로 지정
        const filePath = path.join(__dirname, "..", "json", "3daysWeatherData.json");

        // fs를 활용해 객체 데이터를 json 파일로 저장
        await fs.promises.writeFile(filePath, JSON.stringify(response.data, null, 2));

        // console에 json파일이 저장된 기준 시간을 표시
        console.log(`Success to save weather data : ${year}.${month}.${day} ${convertedHour}시`);
    } catch (error) {
        console.error("Failed to fetch weather data", error);
    }
};

const scheduleTask = () => {
    // 3시간 간격 각 11분마다 실행 (API 제공시간이 3시간 간격 각 10분마다 제공됨)
    cron.schedule("11 2,5,8,11,14,17,20,23 * * *", fetchWeatherData);
};

module.exports = scheduleTask;
