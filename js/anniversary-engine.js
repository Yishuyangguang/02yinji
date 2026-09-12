/**
 * 众水不灭 · 雅歌之印 (Love Universe)
 * 文件名: js/anniversary-engine.js
 * 作用: 1900-2100 高精度农历天文掩码查表算法、公历阴历双向无损转换、三维时间度量矩阵与文化周年阶梯计算
 */

(function (global) {
  "use strict";

  // 1900 - 2100 年农历 24-bit 二进制天文压缩数据表 (紫金山天文台标准)
  // 数据结构: 0x[闰月大小标志(1位)][12个月大小标志(12位)][闰月月份(4位)]
  const LUNAR_INFO = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x1af46, 0x0ab60, 0x09570,
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096e5, 0x092e0,
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
    0x05aa0, 0x076a3, 0x096d0, 0x04bd7, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
    0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06aa0, 0x1a6c4, 0x0aae0,
    0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
    0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
    0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
    0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
    0x0d520
  ];

  const CN_MONTHS = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
  const CN_DAYS = [
    "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
    "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
    "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"
  ];

  class AnniversaryEngineCore {
    /**
     * 获取农历年份的闰月月份 (无闰月返回 0)
     */
    getLunarLeapMonth(year) {
      if (year < 1900 || year > 2100) return 0;
      return LUNAR_INFO[year - 1900] & 0xf;
    }

    /**
     * 获取农历年份闰月的天数 (29 或 30 天，无闰月返回 0)
     */
    getLunarLeapDays(year) {
      if (this.getLunarLeapMonth(year) === 0) return 0;
      return (LUNAR_INFO[year - 1900] & 0x10000) ? 30 : 29;
    }

    /**
     * 获取农历年份特定月份的天数 (29 或 30 天)
     */
    getLunarMonthDays(year, month) {
      if (year < 1900 || year > 2100 || month < 1 || month > 12) return 30;
      return (LUNAR_INFO[year - 1900] & (0x10000 >> month)) ? 30 : 29;
    }

    /**
     * 获取农历年份全年总天数 (353 ~ 385 天)
     */
    getLunarYearDays(year) {
      let sum = 348;
      for (let i = 0x8000; i > 0x8; i >>= 1) {
        sum += (LUNAR_INFO[year - 1900] & i) ? 1 : 0;
      }
      return sum + this.getLunarLeapDays(year);
    }

    /**
     * 农历日期转公历日期 (精准双向无损转换)
     */
    lunarToSolar(lYear, lMonth, lDay, isLeap = false) {
      if (lYear < 1900 || lYear > 2100) return null;

      const leapMonth = this.getLunarLeapMonth(lYear);
      if (isLeap && leapMonth !== lMonth) {
        isLeap = false;
      }

      // 基准时间: 1900年1月31日 为 农历1900年正月初一
      let offset = 0;
      for (let y = 1900; y < lYear; y++) {
        offset += this.getLunarYearDays(y);
      }

      for (let m = 1; m < lMonth; m++) {
        offset += this.getLunarMonthDays(lYear, m);
        if (leapMonth === m) {
          offset += this.getLunarLeapDays(lYear);
        }
      }

      if (isLeap) {
        offset += this.getLunarMonthDays(lYear, lMonth);
      }

      offset += (lDay - 1);

      const baseDate = new Date(1900, 0, 31);
      const targetTime = baseDate.getTime() + offset * 86400000;
      const targetDate = new Date(targetTime);

      return {
        year: targetDate.getFullYear(),
        month: targetDate.getMonth() + 1,
        day: targetDate.getDate(),
        dateStr: `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`
      };
    }

    /**
     * 公历日期转农历日期
     */
    solarToLunar(sYear, sMonth, sDay) {
      const baseDate = new Date(1900, 0, 31);
      const targetDate = new Date(sYear, sMonth - 1, sDay);
      let offset = Math.round((targetDate.getTime() - baseDate.getTime()) / 86400000);

      if (offset < 0) return null;

      let lYear = 1900;
      let tempDays = 0;

      while (lYear <= 2100 && offset > 0) {
        tempDays = this.getLunarYearDays(lYear);
        if (offset >= tempDays) {
          offset -= tempDays;
          lYear++;
        } else {
          break;
        }
      }

      const leapMonth = this.getLunarLeapMonth(lYear);
      let lMonth = 1;
      let isLeap = false;

      while (lMonth <= 12 && offset >= 0) {
        if (isLeap) {
          tempDays = this.getLunarLeapDays(lYear);
          if (offset >= tempDays) {
            offset -= tempDays;
            isLeap = false;
            lMonth++;
          } else {
            break;
          }
        } else {
          tempDays = this.getLunarMonthDays(lYear, lMonth);
          if (offset >= tempDays) {
            offset -= tempDays;
            if (leapMonth === lMonth) {
              isLeap = true;
            } else {
              lMonth++;
            }
          } else {
            break;
          }
        }
      }

      const lDay = offset + 1;

      return {
        lYear,
        lMonth,
        lDay,
        isLeap,
        monthName: (isLeap ? "闰" : "") + (CN_MONTHS[lMonth - 1] || lMonth) + "月",
        dayName: CN_DAYS[lDay - 1] || `${lDay}日`,
        cnString: `农历${isLeap ? "闰" : ""}${CN_MONTHS[lMonth - 1] || lMonth}月${CN_DAYS[lDay - 1] || `${lDay}日`}`
      };
    }

    /**
     * 获取本地绝对零点时间戳 (彻底消除时区与夏令时毫秒除法偏差)
     */
    getLocalMidnightTimestamp(year, month, day) {
      return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
    }

    /**
     * 解析字符串日期为年月日对象 (兼容包含时分秒的字符串，如 "2024-05-20 13:14:00")
     */
    parseDateParts(dateStr) {
      if (!dateStr || typeof dateStr !== "string") return null;
      const clean = String(dateStr).trim().split(/[ T]/)[0];
      const parts = clean.split(/[-/.]/).map(n => parseInt(n, 10));
      if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
        return null;
      }
      return { year: parts[0], month: parts[1], day: parts[2] };
    }

    /**
     * 1. 累积同行天数计算 (Count-Up)
     */
    calculateCountUp(startDateStr) {
      const p = this.parseDateParts(startDateStr);
      if (!p) return { totalDays: 0, years: 0, months: 0, days: 0, summaryText: "0天" };

      const now = new Date();
      const currentMidnight = this.getLocalMidnightTimestamp(now.getFullYear(), now.getMonth() + 1, now.getDate());
      const startMidnight = this.getLocalMidnightTimestamp(p.year, p.month, p.day);

      const totalDays = Math.max(0, Math.round((currentMidnight - startMidnight) / 86400000));

      let curY = now.getFullYear();
      let curM = now.getMonth() + 1;
      let curD = now.getDate();

      let yDiff = curY - p.year;
      let mDiff = curM - p.month;
      let dDiff = curD - p.day;

      if (dDiff < 0) {
        mDiff -= 1;
        const prevMonthLastDay = new Date(curY, curM - 1, 0).getDate();
        dDiff += prevMonthLastDay;
      }
      if (mDiff < 0) {
        yDiff -= 1;
        mDiff += 12;
      }

      return {
        totalDays,
        years: Math.max(0, yDiff),
        months: Math.max(0, mDiff),
        days: Math.max(0, dDiff),
        summaryText: yDiff > 0 ? `${yDiff}年${mDiff}个月${dDiff}天` : `${totalDays}天`
      };
    }

    /**
     * 2. 纪念日/倒数日综合度量计算 (支持公历、农历、每年循环与单次目标)
     */
    calculateAnniversaryMetrics(item) {
      if (!item || !item.date) return null;

      const now = new Date();
      const curYear = now.getFullYear();
      const curMonth = now.getMonth() + 1;
      const curDay = now.getDate();
      const todayMidnight = this.getLocalMidnightTimestamp(curYear, curMonth, curDay);

      const p = this.parseDateParts(item.date);
      if (!p) return null;

      const isLunar = Boolean(item.isLunar);
      const isAnnualRepeat = item.type === "countdown" || Boolean(item.annualRepeat);
      const isLeapMonth = Boolean(item.isLeapMonth);

      // A. 每年重复循环纪念日 (生日/周年)
      if (isAnnualRepeat) {
        let thisYearTargetSolar = null;
        let nextYearTargetSolar = null;
        let prevYearTargetSolar = null;

        if (isLunar) {
          thisYearTargetSolar = this.lunarToSolar(curYear, p.month, p.day, isLeapMonth);
          nextYearTargetSolar = this.lunarToSolar(curYear + 1, p.month, p.day, isLeapMonth);
          prevYearTargetSolar = this.lunarToSolar(curYear - 1, p.month, p.day, isLeapMonth);
        } else {
          thisYearTargetSolar = { year: curYear, month: p.month, day: p.day, dateStr: `${curYear}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}` };
          nextYearTargetSolar = { year: curYear + 1, month: p.month, day: p.day, dateStr: `${curYear + 1}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}` };
          prevYearTargetSolar = { year: curYear - 1, month: p.month, day: p.day, dateStr: `${curYear - 1}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}` };
        }

        const thisYearTime = this.getLocalMidnightTimestamp(thisYearTargetSolar.year, thisYearTargetSolar.month, thisYearTargetSolar.day);
        const nextYearTime = this.getLocalMidnightTimestamp(nextYearTargetSolar.year, nextYearTargetSolar.month, nextYearTargetSolar.day);
        const prevYearTime = this.getLocalMidnightTimestamp(prevYearTargetSolar.year, prevYearTargetSolar.month, prevYearTargetSolar.day);

        let targetSolar = null;
        let cycleStartTime = 0;
        let cycleEndTime = 0;
        let daysRemaining = 0;
        let isToday = false;

        if (todayMidnight === thisYearTime) {
          targetSolar = thisYearTargetSolar;
          daysRemaining = 0;
          isToday = true;
          cycleStartTime = prevYearTime;
          cycleEndTime = thisYearTime;
        } else if (todayMidnight < thisYearTime) {
          targetSolar = thisYearTargetSolar;
          daysRemaining = Math.round((thisYearTime - todayMidnight) / 86400000);
          cycleStartTime = prevYearTime;
          cycleEndTime = thisYearTime;
        } else {
          targetSolar = nextYearTargetSolar;
          daysRemaining = Math.round((nextYearTime - todayMidnight) / 86400000);
          cycleStartTime = thisYearTime;
          cycleEndTime = nextYearTime;
        }

        const totalCycleDays = Math.max(1, Math.round((cycleEndTime - cycleStartTime) / 86400000));
        const passedCycleDays = Math.max(0, Math.round((todayMidnight - cycleStartTime) / 86400000));
        const orbitPercent = isToday ? 100 : Math.min(100, Math.max(0, Math.round((passedCycleDays / totalCycleDays) * 100)));

        const pastYears = Math.max(0, curYear - p.year - (todayMidnight < thisYearTime ? 1 : 0));

        return {
          mode: "annual",
          daysRemaining,
          isToday,
          targetSolarDate: targetSolar.dateStr,
          targetSolarParts: targetSolar,
          orbitPercent,
          pastYears,
          totalCycleDays,
          passedCycleDays,
          formattedLunarDate: isLunar ? `农历${isLeapMonth ? "闰" : ""}${CN_MONTHS[p.month - 1] || p.month}月${CN_DAYS[p.day - 1] || `${p.day}日`}` : ""
        };
      }

      // B. 累积同行天数 (countup)
      if (item.type === "countup") {
        const countUp = this.calculateCountUp(item.date);
        return {
          mode: "countup",
          totalDays: countUp.totalDays,
          years: countUp.years,
          months: countUp.months,
          days: countUp.days,
          summaryText: countUp.summaryText,
          isMilestone: [100, 200, 300, 520, 999, 1000, 1314, 2000, 3000, 5000, 10000].includes(countUp.totalDays)
        };
      }

      // C. 未来单次目标 (target)
      const targetMidnight = this.getLocalMidnightTimestamp(p.year, p.month, p.day);
      const diffDays = Math.round((targetMidnight - todayMidnight) / 86400000);

      return {
        mode: "target",
        daysRemaining: Math.max(0, diffDays),
        isPassed: diffDays < 0,
        isToday: diffDays === 0,
        passedDays: diffDays < 0 ? Math.abs(diffDays) : 0,
        targetSolarDate: item.date
      };
    }

    /**
     * 3. 生命历程羁绊计算 (来到世界的第 N 天，其中有 M 天与你同行)
     */
    calculateLifeBond(birthDateStr, startDateStr, isLunar = false) {
      const birthP = this.parseDateParts(birthDateStr);
      if (!birthP) return null;

      let birthSolar = birthP;
      if (isLunar) {
        birthSolar = this.lunarToSolar(birthP.year, birthP.month, birthP.day, false) || birthP;
      }

      const now = new Date();
      const todayMidnight = this.getLocalMidnightTimestamp(now.getFullYear(), now.getMonth() + 1, now.getDate());
      const birthMidnight = this.getLocalMidnightTimestamp(birthSolar.year, birthSolar.month, birthSolar.day);

      const totalLifeDays = Math.max(1, Math.round((todayMidnight - birthMidnight) / 86400000));
      const countUp = this.calculateCountUp(startDateStr || "2024-05-20");
      const togetherDays = Math.min(totalLifeDays, countUp.totalDays);
      const bondPercent = Math.min(100, Math.max(0, ((togetherDays / totalLifeDays) * 100).toFixed(1)));

      return {
        totalLifeDays,
        togetherDays,
        bondPercent
      };
    }

    /**
     * 4. 文化周年阶梯与恋爱阶段徽章算法
     */
    getAnniversaryStageBadge(years, isMarriage = false) {
      if (isMarriage) {
        const marriageMap = {
          1: "纸婚 · 初始的心动",
          2: "棉婚 · 温暖的交织",
          3: "皮革婚 · 韧性的守护",
          4: "丝婚 · 缠绵的默契",
          5: "木婚 · 扎根的坚固",
          6: "铁婚 · 牢不可破",
          7: "铜婚 · 历久弥新",
          8: "陶婚 · 质朴纯粹",
          9: "柳婚 · 随风依依",
          10: "锡婚 · 柔韧无暇",
          15: "水晶婚 · 澄澈透明",
          20: "瓷婚 · 珍贵典雅",
          25: "银婚 · 恒久闪耀",
          30: "珍珠婚 · 岁月沉淀",
          40: "红宝石婚 · 炽热如初",
          50: "金婚 · 情比金坚",
          60: "钻石婚 · 永恒不朽"
        };
        return marriageMap[years] || (years > 0 ? `同行第 ${years} 载春秋` : "契约初启 · 恩典同在");
      }

      if (years === 0) return "初见倾心 · 晨曦微露";
      if (years === 1) return "相知相守 · 岁岁常欢";
      if (years === 2) return "风雨同舟 · 默契渐深";
      if (years === 3) return "情深似海 · 笃定无畏";
      if (years === 4) return "心有灵犀 · 朝暮相伴";
      if (years >= 5) return "心意相通 · 共赴白头";
      return "恩爱相伴 · 岁月如歌";
    }
  }

  global.AnniversaryEngine = new AnniversaryEngineCore();
})(typeof window !== "undefined" ? window : globalThis);
