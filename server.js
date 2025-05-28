const express = require("express");
const app = express();
const path = require("path");
const axios = require("axios");
const port = 3000;
const { parseStringPromise } = require("xml2js");
const fs = require("fs");
const csv = require("csv-parser");
const iconv = require("iconv-lite");
const cors = require("cors");

const onServerStart = require("./src/startup");
const scheduleTask = require("./src/schedules");

require("dotenv").config();

app.listen(port, () => {
    console.log(`listening on ${port}`);
    onServerStart();
    scheduleTask();
});

app.use(express.json());

app.use(
    cors({
        origin: "https://milli-ulsan.vercel.app",
        methods: ["GET", "POST"],
    })
);

app.get("/api/airkorea/dust", async (req, res) => {
    const time = new Date();
    time.setDate(time.getDate() - 3);
    const year = time.getFullYear().toString();
    let month = time.getMonth() + 1;
    let day = time.getDate();
    day = day.toString().padStart(2, "0");
    month = month.toString().padStart(2, "0");
    const nowDate = `${year}-${month}-${day}`;

    try {
        const response = await axios.get(
            `https://api.odcloud.kr/api/MinuDustFrcstDspthSvrc/v1/getMinuDustWeekFrcstDspth?searchDate=${nowDate}&serviceKey=${process.env.OPEN_DATA_API_KEY}`
        );
        const result = await parseStringPromise(response.data);

        let listArr = ["frcstOneCn", "frcstTwoCn", "frcstThreeCn", "frcstFourCn"];
        let dustData = {};
        listArr.forEach((val, idx) => {
            let data = result.response.body[0].items[0].item[0][val][0];
            let regions = data.split(", ");
            let ulsan = regions.find((region) => region.startsWith("울산"));

            const nowTime = new Date();
            let nowDay = nowTime.getDate();
            let nowMonth = nowTime.getMonth() + 1;
            const lastDayOfMonth = new Date(nowTime.getFullYear(), nowTime.getMonth() + 1, 0).getDate();
            let localDate = nowDay + idx;
            if (localDate > lastDayOfMonth) {
                localDate = localDate - lastDayOfMonth;
                nowMonth++;
                if (nowMonth > 12) nowMonth = 1;
            }
            localDate = localDate.toString().padStart(2, "0");
            dustData[`${nowMonth}/${localDate}`] = ulsan.split(" : ")[1];
        });

        res.json(dustData);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch airkorea dust data" });
    }
});

app.get("/api/kmaWeather/today", async (req, res) => {
    try {
        const weatherData = require("./json/3daysWeatherData.json");
        let data = weatherData.response.body.items.item;
        data = data.slice(0, 30);
        // 가장 가까운 10개시간의 데이터로 필터링
        data = data.map(({ category, fcstDate, fcstTime, fcstValue }) => ({ category, fcstDate, fcstTime, fcstValue }));
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to load three days Weather data" });
    }
});

app.get("/api/kmaWeather/threeDays", async (req, res) => {
    try {
        const weatherData = require("./json/3daysWeatherData.json");
        let data = weatherData.response.body.items.item;
        data = data.filter((_, index) => {
            const groupIndex = Math.floor(index / 24);
            return index - groupIndex * 24 < 3;
        });
        data = data.map(({ category, fcstDate, fcstTime, fcstValue }) => ({ category, fcstDate, fcstTime, fcstValue }));
        // 8시간 간격으로 총 10개시간의 데이터로 필터링
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to load three days Weather data" });
    }
});

app.get("/api/openWeather", async (req, res) => {
    try {
        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?lat=35.5391697&lon=129.3119136&appid=${process.env.OPEN_WEATHER_API_KEY}&units=metric&lang=kr`
        );
        // axios.get으로 json형태의 데이터를 받으면 객체형태로 변환하여 제공된다.
        result = {
            weather: response.data.weather[0],
            main: response.data.main,
            visibility: response.data.visibility,
            wind: response.data.wind,
            rain: response.data.rain || { "1h": 0 },
            clouds: response.data.clouds,
        };
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch weather data" });
    }
});

app.get("/api/ulsanFestival", async (req, res) => {
    const nowMonth = req.query.nowMonth || new Date().getMonth() + 1;
    try {
        const response = await axios.get(
            `https://apis.data.go.kr/6310000/ulsanfestival/getUlsanfestivalList?serviceKey=${process.env.OPEN_DATA_API_KEY}&numOfRows=10&pageNo=1&searchDvsn2=${nowMonth}`
        );
        const result = await parseStringPromise(response.data);
        const festivalData = {
            "totalCount": result.rfcOpenApi.body[0].totalCount[0],
            "data": result.rfcOpenApi.body[0].data[0].list,
        };
        res.json(festivalData);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch festival data" });
    }
});

app.get("/api/ulsanFestivalImage", async (req, res) => {
    const unqId = req.query.unqId || 1;
    try {
        const response = await axios.get(
            `https://apis.data.go.kr/6310000/ulsanfestival/getUlsanfestivalFile?serviceKey=${process.env.OPEN_DATA_API_KEY}&unqId=${unqId}`
        );
        const result = await parseStringPromise(response.data);
        const festivalImageList = result.rfcOpenApi.body[0].data[0].list;
        const festivalImage = {
            "data": festivalImageList[festivalImageList.length - 1].fileUrl[0],
        };
        res.json(festivalImage);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch festival image data" });
    }
});

app.get("/api/ulsanMedical", async (req, res) => {
    const city = req.query.city || "북구";
    const category = req.query.category || "병원";
    const results = [];

    const csvFilePath = path.join(__dirname, "./csv/ulsanMedicalData.csv");

    fs.readFile(csvFilePath, (err, data) => {
        if (err) {
            console.error(err);
            res.status(500).send("Error reading the file");
            return;
        }

        const convertedData = iconv.decode(data, "euc-kr");

        const stream = require("stream");
        const bufferStream = new stream.PassThrough();
        bufferStream.end(Buffer.from(convertedData));

        bufferStream
            .pipe(csv())
            .on("data", (data) => {
                if (data["구군"] === city && data["종별"] === category) {
                    results.push(data);
                }
            })
            .on("end", () => {
                res.json(results);
            });
    });
});

app.get("/api/ulsanCultural", async (req, res) => {
    try {
        const response = await axios.get(
            `https://apis.data.go.kr/6310000/ulsanculturalfacility/getulsanculturalfacilityList?serviceKey=${process.env.OPEN_DATA_API_KEY}&CATEGORY=문화예술회관&numOfRows=100`
        );
        const result = await parseStringPromise(response.data);
        const culturalIns = result.rfcOpenApi.body[0].data[0].list;

        // 배열 내 객체를 비교하여 중복 제거 (다수의 객체는 모두 별개로 보므로 중복을 제거하는 new Set 활용 불가능)
        const test = culturalIns.filter(
            (val, idx, self) => idx === self.findIndex((t) => t.facility[0] === val.facility[0])
        );

        res.json(test);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch cultural facility data" });
    }
});

app.get("/api/ulsanCinema", async (req, res) => {
    const city = req.query.city || "북구";
    const results = [];

    const csvFilePath = path.join(__dirname, "./csv/ulsanCinemaData.csv");

    fs.readFile(csvFilePath, (err, data) => {
        if (err) {
            console.error(err);
            res.status(500).send("Error reading the file");
            return;
        }

        const convertedData = iconv.decode(data, "euc-kr");

        const stream = require("stream");
        const bufferStream = new stream.PassThrough();
        bufferStream.end(Buffer.from(convertedData));

        bufferStream
            .pipe(csv())
            .on("data", (data) => {
                if (data["구군명"] === city) {
                    results.push(data);
                }
            })
            .on("end", () => {
                res.json(results);
            });
    });
});
