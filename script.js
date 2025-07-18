let scheduleData = [];

// YAML 파일 로드 함수
async function loadScheduleData() {
    try {
        const response = await fetch('schedule.yml');
        const yamlText = await response.text();
        const data = jsyaml.load(yamlText);
        scheduleData = data.schedule;
        
        // 시간 계산 및 데이터 준비
        prepareChartData();
        createChart();
    } catch (error) {
        console.error('스케줄 데이터 로드 실패:', error);
        // 기본 데이터로 대체
        loadDefaultData();
    }
}


// 기본 데이터 (YAML 로드 실패 시)
function loadDefaultData() {
    scheduleData = [
        { time: "06:00-07:00", task: "기상/세안" },
        { time: "07:00-08:30", task: "운동" },
        { time: "08:30-09:00", task: "샤워/준비" },
        { time: "09:00-12:00", task: "업무 (오전)" },
        { time: "12:00-13:00", task: "점심" },
        { time: "13:00-18:00", task: "업무 (오후)" },
        { time: "18:00-19:00", task: "저녁" },
        { time: "19:00-21:00", task: "개인시간" },
        { time: "21:00-22:00", task: "독서/공부" },
        { time: "22:00-23:00", task: "휴식" },
        { time: "23:00-06:00", task: "수면" }
    ];
    
    prepareChartData();
    createChart();
}

// 시간 문자열을 분으로 변환
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// 시간 범위의 지속 시간 계산 (분)
function calculateDuration(timeRange) {
    const [start, end] = timeRange.split('-');
    let startMinutes = timeToMinutes(start);
    let endMinutes = timeToMinutes(end);
    
    // 다음 날로 넘어가는 경우 (예: 23:00-06:00)
    if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
    }
    
    return endMinutes - startMinutes;
}

// 분을 시간:분 형태로 변환
function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}시간 ${mins}분`;
}

// 차트 데이터 준비
function prepareChartData() {
    scheduleData.forEach(item => {
        item.duration = calculateDuration(item.time);
        // 디버깅: 각 영역의 시간 계산 확인
    });
    
    // 총 시간 확인 (24시간 = 1440분 기준)
    const actualTotalMinutes = scheduleData.reduce((sum, item) => sum + item.duration, 0);
    const standardTotalMinutes = 1440;
    
    // 각 영역의 높이 퍼센트 확인
    let totalPercentage = 0;
    scheduleData.forEach(item => {
        const percentage = (item.duration / actualTotalMinutes) * 100;
        totalPercentage += percentage;
    });
}

// 시간 눈금 생성 함수 (픽셀 단위)
function createTimeScale() {
    const timeScale = document.createElement('div');
    timeScale.className = 'time-scale';
    
    // 24시간 (00:00 ~ 23:00)을 1시간 단위로 생성
    for (let hour = 0; hour < 24; hour++) {
        const timeLabel = document.createElement('div');
        timeLabel.className = 'time-label';
        timeLabel.textContent = `${String(hour).padStart(2, '0')}:00`;
        timeScale.appendChild(timeLabel);
    }
    
    return timeScale;
}

// 특정 시간의 위치 계산 (픽셀 단위)
function calculateTimePositionPx(targetMinutes) {
    let cumulativePixels = 0;
    const pixelPerMinute = 720 / 1440; // 0.5px per minute
    
    for (let i = 0; i < scheduleData.length; i++) {
        const item = scheduleData[i];
        const [startTime, endTime] = item.time.split('-');
        const startMinutes = timeToMinutes(startTime);
        let endMinutes = timeToMinutes(endTime);
        
        // 다음 날로 넘어가는 경우 처리
        if (endMinutes < startMinutes) {
            endMinutes += 24 * 60;
        }
        
        const segmentHeightPx = Math.round(item.duration * pixelPerMinute);
        
        // 대상 시간이 이 구간에 속하는지 확인
        let isInSegment = false;
        let isExactBoundary = false;
        
        if (endMinutes > 24 * 60) {
            // 다음날로 넘어가는 구간 (22:00-00:00)
            isInSegment = (targetMinutes >= startMinutes) || (targetMinutes <= (endMinutes - 24 * 60));
            isExactBoundary = (targetMinutes === startMinutes) || (targetMinutes === 0 && endMinutes === 24 * 60);
        } else {
            // 일반 구간
            isInSegment = (targetMinutes >= startMinutes) && (targetMinutes <= endMinutes);
            isExactBoundary = (targetMinutes === startMinutes) || (targetMinutes === endMinutes);
        }
        
        if (isExactBoundary && targetMinutes === startMinutes) {
            // 구간 시작점에 정확히 일치
            return cumulativePixels;
        }
        
        if (isInSegment) {
            // 구간 내에서의 정확한 위치 계산
            let offsetInSegment;
            if (endMinutes > 24 * 60 && targetMinutes < startMinutes) {
                // 다음날로 넘어가는 경우 (00:00-끝시간)
                offsetInSegment = targetMinutes;
            } else {
                // 일반적인 경우
                offsetInSegment = targetMinutes - startMinutes;
            }
            
            const offsetPixels = Math.round(offsetInSegment * pixelPerMinute);
            return cumulativePixels + offsetPixels;
        }
        
        cumulativePixels += segmentHeightPx;
    }
    
    // 기본값 반환 (오류 방지)
    return Math.round(targetMinutes * pixelPerMinute);
}





// 말풍선 표시 함수
function showTooltip(segment, item, event) {
    // 기존 말풍선 제거
    hideTooltip();
    
    // 새 말풍선 생성
    const tooltip = document.createElement('div');
    tooltip.className = 'time-tooltip';
    tooltip.id = 'activeTooltip';
    
    // 말풍선 내용
    tooltip.innerHTML = `
        <div class="tooltip-content">
            <div class="tooltip-task">${item.task}</div>
            <div class="tooltip-time">${item.time}</div>
            <div class="tooltip-duration">${Math.floor(item.duration/60)}시간 ${item.duration%60}분</div>
        </div>
        <div class="tooltip-arrow"></div>
    `;
    
    // 말풍선을 body에 추가 (제목 아래 고정 위치)
    tooltip.style.position = 'fixed';
    tooltip.style.top = '140px';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translateX(-50%)';
    tooltip.style.zIndex = '1000';
    
    document.body.appendChild(tooltip);
    
    // 말풍선은 항상 오른쪽에 표시 (위치 조정 제거)
}

// 말풍선 숨기기 함수
function hideTooltip() {
    const existingTooltip = document.getElementById('activeTooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }
}

// 현재 시간 위치 계산 (픽셀 단위) - 24시간 기준 단순 계산
function calculateCurrentTimePosition(currentTotalMinutes) {
    // 24시간 기준 단순 계산 (720px = 1440분)
    const pixelPerMinute = 720 / 1440; // 0.5px per minute
    return Math.round(currentTotalMinutes * pixelPerMinute);
}

// 세로 막대 차트 생성
function createChart() {
    const chartContainer = document.getElementById('scheduleChart');
    
    // 기존 내용 제거
    chartContainer.innerHTML = '';
    
    // 24시간 = 1440분 기준으로 계산
    const totalMinutes = 1440;
    
    // 막대 차트 컨테이너 생성
    const barContainer = document.createElement('div');
    barContainer.className = 'bar-container';
    
    // 현재 시간 계산 (현재 활동 강조용)
    const now = new Date();
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
    
    // 24시간(1440분) 기준으로 계산 (시간 눈금과 동일한 기준)
    const baseTotalMinutes = 1440;
    
    // 전체 높이를 픽셀 단위로 계산 (720px = 24시간 기준)
    const totalHeightPx = 720;
    const pixelPerMinute = totalHeightPx / 1440; // 0.5px per minute
    
    scheduleData.forEach((item, index) => {
        const heightPx = Math.round(item.duration * pixelPerMinute);
        
        // 각 시간대별 막대 조각 생성
        const barSegment = document.createElement('div');
        barSegment.className = 'bar-segment';
        barSegment.style.height = `${heightPx}px`;
        barSegment.style.flexShrink = '0';
        
        // 현재 시간이 이 시간대에 포함되는지 확인 (00:00 기준 단순 버전)
        const [startTime, endTime] = item.time.split('-');
        const startMinutes = timeToMinutes(startTime);
        let endMinutes = timeToMinutes(endTime);
        
        // 다음 날로 넘어가는 경우 처리 (예: 22:30-00:00)
        if (endMinutes < startMinutes) {
            endMinutes += 24 * 60;
        }
        
        let isCurrentTime = false;
        
        // 현재 시간이 스케줄 시간대에 포함되는지 확인
        if (endMinutes > 24 * 60) {
            // 다음 날로 넘어가는 시간대 (예: 22:30-00:00)
            isCurrentTime = currentTotalMinutes >= startMinutes;
        } else {
            // 일반적인 시간대
            isCurrentTime = currentTotalMinutes >= startMinutes && currentTotalMinutes < endMinutes;
        }
        
        // 연녹색 계열 색상 생성
        const opacity = 0.7 + (index * 0.03) % 0.3; // 0.7 ~ 1.0 사이
        const greenShade = 120 + (index * 10) % 60; // 120 ~ 180도 (녹색 계열)
        
        if (isCurrentTime) {
            // 현재 시간대는 더 밝고 강조된 색상
            barSegment.style.backgroundColor = `hsla(${greenShade}, 80%, 80%, ${opacity + 0.2})`;
            barSegment.classList.add('current-activity');
        } else {
            barSegment.style.backgroundColor = `hsla(${greenShade}, 60%, 70%, ${opacity})`;
        }
        
        // 텍스트 내용 생성 (작업명만 표시)
        const textContent = document.createElement('div');
        textContent.className = 'bar-text';
        textContent.innerHTML = `
            <div class="task-name">${item.task}</div>
        `;
        
        barSegment.appendChild(textContent);
        
        // 클릭 이벤트 추가
        barSegment.addEventListener('click', (e) => {
            e.stopPropagation(); // 이벤트 버블링 방지
            showTooltip(barSegment, item, e);
        });
        
        barContainer.appendChild(barSegment);
    });
    
    // 차트 래퍼 생성
    const chartWrapper = document.createElement('div');
    chartWrapper.className = 'chart-wrapper';
    
    // 시간 눈금 생성
    const timeScale = createTimeScale();
    chartWrapper.appendChild(timeScale);
    
    // 막대 차트 추가
    chartWrapper.appendChild(barContainer);
    
    // 차트 컨테이너에 래퍼 추가
    chartContainer.appendChild(chartWrapper);
    
    // 현재 시간 선 생성
    const currentTimeLine = document.createElement('div');
    currentTimeLine.className = 'current-time-line';
    currentTimeLine.innerHTML = '<div class="current-time-text"></div>';
    barContainer.appendChild(currentTimeLine);
    
    // 현재 활동 강조 및 시간 선 업데이트 (100ms마다)
    setInterval(() => {
        const now = new Date();
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
        updateCurrentActivity(barContainer, currentTotalMinutes);
        updateCurrentTimeLine(barContainer, currentTotalMinutes);
    }, 100);
    
    // 초기 시간 선 위치 설정
    updateCurrentTimeLine(barContainer, currentTotalMinutes);
}

// 현재 시간 선 위치 업데이트
function updateCurrentTimeLine(container, currentTotalMinutes) {
    const timeLine = container.querySelector('.current-time-line');
    const timeText = timeLine.querySelector('.current-time-text');
    
    if (timeLine && timeText) {
        // 현재 시간의 정확한 픽셀 위치 계산
        const currentPosition = calculateTimePositionPx(currentTotalMinutes);
        
        // 시간 선 위치 설정
        timeLine.style.top = `${currentPosition}px`;
        
        // 현재 시간 텍스트 업데이트
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        timeText.textContent = `${hours}:${minutes}`;
    }
}

// 현재 활동 강조 업데이트
function updateCurrentActivity(container, currentTotalMinutes) {
    const segments = container.querySelectorAll('.bar-segment');
    
    segments.forEach((segment, index) => {
        const item = scheduleData[index];
        const [startTime, endTime] = item.time.split('-');
        const startMinutes = timeToMinutes(startTime);
        let endMinutes = timeToMinutes(endTime);
        
        // 다음 날로 넘어가는 경우 처리
        if (endMinutes < startMinutes) {
            endMinutes += 24 * 60;
        }
        
        let isCurrentTime = false;
        
        // 현재 시간이 스케줄 시간대에 포함되는지 확인 (00:00 기준 단순 버전)
        if (endMinutes > 24 * 60) {
            // 다음 날로 넘어가는 시간대 (예: 22:30-00:00)
            isCurrentTime = currentTotalMinutes >= startMinutes;
        } else {
            // 일반적인 시간대
            isCurrentTime = currentTotalMinutes >= startMinutes && currentTotalMinutes < endMinutes;
        }
        
        // 현재 활동 스타일 적용/제거
        if (isCurrentTime) {
            segment.classList.add('current-activity');
            const opacity = 0.7 + (index * 0.03) % 0.3;
            const greenShade = 120 + (index * 10) % 60;
            segment.style.backgroundColor = `hsla(${greenShade}, 80%, 80%, ${opacity + 0.2})`;
        } else {
            segment.classList.remove('current-activity');
            const opacity = 0.7 + (index * 0.03) % 0.3;
            const greenShade = 120 + (index * 10) % 60;
            segment.style.backgroundColor = `hsla(${greenShade}, 60%, 70%, ${opacity})`;
            segment.style.backgroundImage = 'none'; // 빗금 제거
        }
    });
}











// 시급 계산 관련 변수
const HOURLY_RATE = 10030; // 시급 10,030원
const DAILY_TOTAL = 24 * HOURLY_RATE; // 하루 총 금액: 240,720원
const RATE_PER_SECOND = HOURLY_RATE / 3600; // 1초당 금액: 약 2.786원

// 시급 계산 및 업데이트
function updateMoneyCounter() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    const currentMillisecond = now.getMilliseconds();
    
    // 자정부터 현재까지 경과 시간 (밀리초 포함)
    const elapsedMilliseconds = currentHour * 3600000 + currentMinute * 60000 + currentSecond * 1000 + currentMillisecond;
    
    // 자정까지 남은 시간 (밀리초)
    const remainingMilliseconds = 86400000 - elapsedMilliseconds; // 24시간 = 86400000밀리초
    
    // 남은 시간을 시:분:초.밀리초로 변환
    const remainingHours = Math.floor(remainingMilliseconds / 3600000);
    const remainingMinutes = Math.floor((remainingMilliseconds % 3600000) / 60000);
    const remainingSeconds = Math.floor((remainingMilliseconds % 60000) / 1000);
    const remainingMillisecondsOnly = Math.floor((remainingMilliseconds % 1000) / 100); // 소수점 한자리
    const remainingTime = `${String(remainingHours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}.${remainingMillisecondsOnly}`;
    
    // 남은 금액 계산 (밀리초 단위까지 정확히)
    const remainingAmount = (remainingMilliseconds / 1000) * RATE_PER_SECOND;
    
    // DOM 업데이트
    const dailyTotalElement = document.getElementById('dailyTotal');
    const remainingAmountElement = document.getElementById('remainingAmount');
    const elapsedTimeElement = document.getElementById('elapsedTime');
    
    if (dailyTotalElement) {
        dailyTotalElement.textContent = `${DAILY_TOTAL.toLocaleString()}원`;
    }
    if (remainingAmountElement) {
        // 생동감 있는 색상 변화 적용
        const percentage = (remainingMilliseconds / 86400000) * 100;
        let colorClass = '';
        if (percentage > 75) {
            colorClass = 'high-remaining';
        } else if (percentage > 50) {
            colorClass = 'medium-remaining';
        } else if (percentage > 25) {
            colorClass = 'low-remaining';
        } else {
            colorClass = 'critical-remaining';
        }
        
        remainingAmountElement.textContent = `${remainingAmount.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}원`;
        remainingAmountElement.className = `remaining-amount ${colorClass}`;
    }
    if (elapsedTimeElement) {
        elapsedTimeElement.textContent = remainingTime;
        
        // 시간에 따른 색상 변화
        const percentage = (remainingMilliseconds / 86400000) * 100;
        let colorClass = '';
        if (percentage > 75) {
            colorClass = 'high-remaining';
        } else if (percentage > 50) {
            colorClass = 'medium-remaining';
        } else if (percentage > 25) {
            colorClass = 'low-remaining';
        } else {
            colorClass = 'critical-remaining';
        }
        
        elapsedTimeElement.className = `elapsed-time ${colorClass}`;
    }
}

// 브라우저의 스크롤 복원 기능 비활성화
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', function() {
    // 페이지 로딩 시 스크롤을 최상단으로 이동
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // 초기 데이터 로드
    loadScheduleData();
    
    // 시급 계산 초기 실행
    updateMoneyCounter();
    
    // 1초마다 시급 계산 업데이트
    setInterval(updateMoneyCounter, 100);
    
    // 외부 클릭 시 말풍선 숨기기
    document.addEventListener('click', function(e) {
        // 클릭된 요소가 bar-segment나 tooltip이 아니면 말풍선 숨기기
        if (!e.target.closest('.bar-segment') && !e.target.closest('.time-tooltip')) {
            hideTooltip();
        }
    });
    
    // 스크롤이나 리사이즈 시 말풍선 숨기기
    window.addEventListener('scroll', hideTooltip);
    window.addEventListener('resize', hideTooltip);
    
    // 페이지 새로고침 시 스크롤 위치 초기화
    window.addEventListener('beforeunload', function() {
        window.scrollTo(0, 0);
    });
});

// 페이지가 완전히 로드된 후에도 스크롤 위치 확인
window.addEventListener('load', function() {
    setTimeout(function() {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
    }, 100);
});

 
// 돈 비 애니메이션 함수들
function createMoneyRain() {
    const moneyRain = document.querySelector('.money-rain');
    if (!moneyRain) return;
    
    // 동전 생성
    function createCoin() {
        const coin = document.createElement('div');
        coin.className = Math.random() > 0.5 ? 'coin' : 'coin spin';
        coin.style.left = Math.random() * 100 + '%';
        coin.style.animationDelay = Math.random() * 0.5 + 's';
        coin.style.animationDuration = (Math.random() * 1.5 + 1.5) + 's';
        
        // 다양한 크기의 동전
        const scale = Math.random() * 0.6 + 0.7; // 0.7 ~ 1.3
        coin.style.transform = `scale(${scale})`;
        
        // 다양한 투명도
        const opacity = Math.random() * 0.3 + 0.2; // 0.2 ~ 0.5
        coin.style.opacity = opacity;
        
        moneyRain.appendChild(coin);
        
        // 애니메이션 완료 후 요소 제거
        setTimeout(() => {
            if (coin.parentNode) {
                coin.parentNode.removeChild(coin);
            }
        }, 4000);
    }
    

    
    // 초기 생성
    for (let i = 0; i < 20; i++) {
        setTimeout(createCoin, Math.random() * 500);
    }
    
    // 지속적인 생성
    setInterval(createCoin, 400);
    setInterval(createCoin, 600); // 다른 패턴의 생성
}

// 페이지 로드 시 돈 비 애니메이션 시작
window.addEventListener('load', () => {
    setTimeout(createMoneyRain, 1000); // 1초 후 시작
});

 