/**
 * 華佳ちゃん スケジュール＆お出かけマネージャー (app.js)
 * Mac / iPad Safari & Chrome 最適化
 */

// ==========================================
// 1. アプリケーション状態管理 (State)
// ==========================================
const AppState = {
  currentYear: 2026,
  currentMonth: 11, // デフォルトで来月(11月)を表示
  settings: {
    geminiApiKey: '',
    ruleThu: true,
    ruleSat: true,
    weekdayTime: '14:30〜17:30',
    satTime: '10:00〜16:00',
    userName: '華佳',
    providerName: '有限会社 かいと支援センター',
    meetingPlace: '自宅',
    totalPages: '1',
    currentPage: '1'
  },
  // 日本の祝日データ（2026年サンプル＋自動算出フォールバック）
  holidays: {
    '2026-10-12': 'スポーツの日',
    '2026-11-03': '文化の日',
    '2026-11-23': '勤労感謝の日',
    '2026-12-23': '祝日',
    '2027-01-01': '元日',
    '2027-01-11': '成人の日'
  },
  // 学校行事リスト（お便りから抽出されたデータ）
  schoolEvents: [
    { id: 'ev-1', date: '2026-11-04', title: '身体計測', dismissalTime: '14:30', type: 'normal' },
    { id: 'ev-2', date: '2026-11-12', title: '校外学習（給食なし・午前下校）', dismissalTime: '11:30', type: 'early' },
    { id: 'ev-3', date: '2026-11-19', title: '授業参観・保護者懇談会', dismissalTime: '13:30', type: 'early' },
    { id: 'ev-4', date: '2026-11-26', title: '避難訓練', dismissalTime: '14:30', type: 'normal' }
  ],
  // 放デイ利用予定マップ { 'YYYY-MM-DD': { active: boolean, reason: string, time: string } }
  dayServiceMap: {},
  // お出かけ先データベース（在庫管理）
  spots: [
    { id: 'spot-1', name: '近隣公園・ゆうやけ散歩', category: 'park', status: 'unfulfilled', notes: '平日放課後(15:00〜)の短時間散歩。遊具やおやつ休憩' },
    { id: 'spot-2', name: '駅前カフェ・おやつタイム', category: 'shopping', status: 'unfulfilled', notes: '放課後1.5〜2時間枠。ジュースとケーキでおしゃべり' },
    { id: 'spot-3', name: '須磨海浜水族園 (スマシー)', category: 'museum', status: 'unfulfilled', notes: '休日枠：リニューアル後まだ行けていない！イルカショー希望' },
    { id: 'spot-4', name: '伊丹スカイパーク', category: 'park', status: 'visited', notes: '飛行機が間近で見えて大興奮だった。ピクニック最適' },
    { id: 'spot-5', name: '阪急西宮ガーデンズ 屋上庭園', category: 'shopping', status: 'unfulfilled', notes: '電車移動の練習も兼ねて。カフェでおやつ' },
    { id: 'spot-6', name: '神戸どうぶつ王国', category: 'museum', status: 'unfulfilled', notes: '雨の日でも濡れずに楽しめる。バードショー' },
    { id: 'spot-7', name: '猪名川河川敷公園', category: 'park', status: 'visited', notes: '芝生でお弁当。シャボン玉遊び' },
    { id: 'spot-8', name: '図書館・児童書コーナー', category: 'indoor', status: 'unfulfilled', notes: '平日放課後の静かな室内活動。絵本読書' }
  ],
  // 移動支援割り当てスロット [ { id, date, startTime, endTime, spotId, spotName, remarks, status: 'requested'|'confirmed'|'cancelled' } ]
  mobilityAssignments: [
    { id: 'mob-1', date: '2026-11-08', startTime: '13:00', endTime: '17:00', spotId: 'spot-1', spotName: '須磨海浜水族園 (スマシー)', remarks: '電車・バス移動', status: 'requested' },
    { id: 'mob-2', date: '2026-11-15', startTime: '13:00', endTime: '16:30', spotId: 'spot-3', spotName: '阪急西宮ガーデンズ 屋上庭園', remarks: 'カフェでおやつ', status: 'requested' }
  ],
  // FAX用紙テンプレート画像（データURL）
  customFaxTemplateDataUrl: null
};

// ==========================================
// 2. ローカルストレージ & データ同期
// ==========================================
const StorageManager = {
  KEY: 'hanaka_schedule_manager_data_v1',

  save() {
    try {
      const data = {
        currentYear: AppState.currentYear,
        currentMonth: AppState.currentMonth,
        settings: AppState.settings,
        schoolEvents: AppState.schoolEvents,
        dayServiceMap: AppState.dayServiceMap,
        spots: AppState.spots,
        mobilityAssignments: AppState.mobilityAssignments
      };
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.settings) AppState.settings = { ...AppState.settings, ...parsed.settings };
        if (parsed.schoolEvents) AppState.schoolEvents = parsed.schoolEvents;
        if (parsed.dayServiceMap) AppState.dayServiceMap = parsed.dayServiceMap;
        if (parsed.spots) AppState.spots = parsed.spots;
        if (parsed.mobilityAssignments) {
          // 既存データマイグレーション: statusがない場合は 'requested' を補完
          AppState.mobilityAssignments = parsed.mobilityAssignments.map(item => ({
            ...item,
            status: item.status || 'requested'
          }));
        }
      }
    } catch (e) {
      console.error('LocalStorage load error:', e);
    }
  },

  exportToiCloudJson() {
    const exportData = {
      version: '1.0',
      appName: 'HanakaScheduleManager',
      exportedAt: new Date().toISOString(),
      year: AppState.currentYear,
      month: AppState.currentMonth,
      settings: AppState.settings,
      schoolEvents: AppState.schoolEvents,
      dayServiceMap: AppState.dayServiceMap,
      spots: AppState.spots,
      mobilityAssignments: AppState.mobilityAssignments
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `華佳ちゃん予定データ_${AppState.currentYear}年${AppState.currentMonth}月.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('iCloud保存用のJSONファイルをダウンロードしました。iCloud Driveまたはファイルアプリに保存してください。');
  },

  importFromiCloudJson(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported.spots) AppState.spots = imported.spots;
        if (imported.schoolEvents) AppState.schoolEvents = imported.schoolEvents;
        if (imported.dayServiceMap) AppState.dayServiceMap = imported.dayServiceMap;
        if (imported.mobilityAssignments) AppState.mobilityAssignments = imported.mobilityAssignments;
        if (imported.settings) AppState.settings = { ...AppState.settings, ...imported.settings };

        StorageManager.save();
        AppUI.renderAll();
        alert('iCloudデータを正常に読み込みました！');
      } catch (err) {
        alert('ファイルの読み込みに失敗しました。正しいJSONファイルかご確認ください。');
      }
    };
  }
};

// ==========================================
// 2.5. 移動支援 ステータス管理＆在庫復活ロジック
// ==========================================
const MobilityManager = {
  // ステータスを「確定」に変更
  confirmAssignment(mobId) {
    const item = AppState.mobilityAssignments.find(m => m.id === mobId);
    if (!item) return;
    item.status = 'confirmed';
    StorageManager.save();
    AppUI.renderAll();
    AppUI.showToast(`🚙「${item.spotName}」の移動支援が【確定】しました！`, 'success');
  },

  // ステータスを「見送り（キャンセル）」に変更＆【在庫復活】
  cancelAssignment(mobId) {
    const item = AppState.mobilityAssignments.find(m => m.id === mobId);
    if (!item) return;

    item.status = 'cancelled';

    // ★重要: 在庫復活ロジック
    // 枠が取れなかったため、該当するお出かけ先スポットを「未達・希望中」に自動で戻す
    const spot = AppState.spots.find(s => s.id === item.spotId || s.name === item.spotName);
    if (spot) {
      spot.status = 'unfulfilled';
    }

    StorageManager.save();
    AppUI.renderAll();
    AppUI.showToast(`✕「${item.spotName}」を見送りにしました。お出かけ先ストック（未達リスト）に自動復活しました✨`, 'warning');
  },

  // ステータスを「希望中」に戻す
  revertToRequested(mobId) {
    const item = AppState.mobilityAssignments.find(m => m.id === mobId);
    if (!item) return;
    item.status = 'requested';
    StorageManager.save();
    AppUI.renderAll();
    AppUI.showToast(`📝「${item.spotName}」を希望申請中に戻しました。`, 'info');
  },

  // 見送りスロットを完全に削除し、空き枠（未割当）に戻す
  reopenSlot(mobId) {
    const item = AppState.mobilityAssignments.find(m => m.id === mobId);
    if (!item) return;

    // スポットを未達リストに復活
    const spot = AppState.spots.find(s => s.id === item.spotId || s.name === item.spotName);
    if (spot) {
      spot.status = 'unfulfilled';
    }

    // 割り当てリストから削除
    AppState.mobilityAssignments = AppState.mobilityAssignments.filter(m => m.id !== mobId);
    StorageManager.save();
    AppUI.renderAll();
    AppUI.showToast('空き枠を再解放しました。別の行き先を割り当てられます。', 'info');
  }
};

// ==========================================
// 2.6. Google / Appleカレンダー (.ics) エクスポート
// ==========================================
const IcsExportLogic = {
  // 日時文字列 (YYYY-MM-DD, HH:mm) から iCalendar用フォーマット (YYYYMMDDTHHmm00) を生成
  formatDateTime(dateStr, timeStr) {
    const cleanDate = dateStr.replace(/-/g, '');
    const [h, m] = (timeStr || '09:00').split(':');
    const cleanH = String(h).padStart(2, '0');
    const cleanM = String(m || '00').padStart(2, '0');
    return `${cleanDate}T${cleanH}${cleanM}00`;
  },

  // 翌日の日付キーを生成 (終日イベント用)
  getNextDateKey(dateStr) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  },

  // 時間レンジ文字列 ("14:30〜17:30") を開始・終了に分解
  parseTimeRange(timeStr, defaultStart, defaultEnd) {
    if (!timeStr) return { start: defaultStart, end: defaultEnd };
    const match = timeStr.match(/(\d{1,2}:\d{2})\s*[〜~-]\s*(\d{1,2}:\d{2})/);
    if (match) {
      return { start: match[1], end: match[2] };
    }
    return { start: defaultStart, end: defaultEnd };
  },

  generateIcs() {
    const year = AppState.currentYear;
    const month = AppState.currentMonth;
    const nowIso = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const events = [];

    // 1. 放デイ予定 (当月で active === true の日程)
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    Object.keys(AppState.dayServiceMap).forEach(dateKey => {
      if (!dateKey.startsWith(monthPrefix)) return;
      const ds = AppState.dayServiceMap[dateKey];
      if (!ds || !ds.active) return;

      const dateObj = new Date(dateKey);
      const isSat = dateObj.getDay() === 6;
      const defStart = isSat ? '10:00' : '14:30';
      const defEnd = ds.returnTime || (isSat ? '16:00' : '17:30');
      const { start, end } = this.parseTimeRange(ds.time, ds.startTime || defStart, ds.returnTime || defEnd);

      const dtStart = this.formatDateTime(dateKey, start);
      const dtEnd = this.formatDateTime(dateKey, end);

      events.push([
        'BEGIN:VEVENT',
        `UID:dayservice-${dateKey}-${Date.now()}@hanaka.app`,
        `DTSTAMP:${nowIso}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:【放デイ】華佳ちゃん利用 (〜${end}着)`,
        `DESCRIPTION:放課後等デイサービスの利用予定日です。\\n送迎帰着時間: ${end}頃着\\n理由: ${ds.reason || '定期利用'}\\nメモ: ${ds.notes || 'なし'}`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      ].join('\r\n'));
    });

    // 2. 移動支援 (当月で 見送り/cancelled 以外の予定)
    AppState.mobilityAssignments.forEach(mob => {
      if (!mob.date.startsWith(monthPrefix)) return;
      if (mob.status === 'cancelled') return; // 見送りはカレンダーに入れない

      const isConfirmed = mob.status === 'confirmed';
      const dtStart = this.formatDateTime(mob.date, mob.startTime || '13:00');
      const dtEnd = this.formatDateTime(mob.date, mob.endTime || '17:00');
      const statusLabel = isConfirmed ? '確定' : '希望申請中';

      events.push([
        'BEGIN:VEVENT',
        `UID:mobility-${mob.id}@hanaka.app`,
        `DTSTAMP:${nowIso}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:【移動支援・${statusLabel}】${mob.spotName} (華佳)`,
        `LOCATION:${mob.spotName}`,
        `DESCRIPTION:移動支援のお出かけ予定です。\\n行き先: ${mob.spotName}\\nステータス: ${statusLabel}\\n時間: ${mob.startTime}〜${mob.endTime}\\n備考: ${mob.remarks || 'なし'}`,
        `STATUS:${isConfirmed ? 'CONFIRMED' : 'TENTATIVE'}`,
        'END:VEVENT'
      ].join('\r\n'));
    });

    // 3. 学校予定 (当月)
    AppState.schoolEvents.forEach(ev => {
      if (!ev.date.startsWith(monthPrefix)) return;
      const cleanDate = ev.date.replace(/-/g, '');
      const nextDate = this.getNextDateKey(ev.date);

      events.push([
        'BEGIN:VEVENT',
        `UID:school-${ev.id}@hanaka.app`,
        `DTSTAMP:${nowIso}`,
        `DTSTART;VALUE=DATE:${cleanDate}`,
        `DTEND;VALUE=DATE:${nextDate}`,
        `SUMMARY:【学校】${ev.title} (下校 ${ev.dismissalTime})`,
        `DESCRIPTION:こやの里 月間行事予定\\n行事名: ${ev.title}\\n下校時刻: ${ev.dismissalTime}\\n区分: ${ev.type === 'early' ? '⚠️ 早帰り・変則' : '通常'}`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      ].join('\r\n'));
    });

    // iCalendar 全体組み立て
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Hanaka Schedule Manager//JA',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:華佳ちゃん予定表 (${year}年${month}月)`,
      'X-WR-TIMEZONE:Asia/Tokyo',
      ...events,
      'END:VCALENDAR'
    ].join('\r\n');

    return icsContent;
  },

  downloadIcs() {
    const icsData = this.generateIcs();
    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `華佳ちゃんスケジュール_${AppState.currentYear}年${AppState.currentMonth}月.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    AppUI.showToast(`📅 ${AppState.currentYear}年${AppState.currentMonth}月のカレンダー一括登録ファイル (.ics) を書き出しました！`, 'success');
  }
};

// ==========================================
// 3. 放デイ自動算出ロジック（カンニングペーパー機能）
// ==========================================
const DayServiceLogic = {
  // 指定された年月の放デイ候補日を基本ルールから自動生成
  calculateSchedule(year, month) {
    const newMap = {};
    const daysInMonth = new Date(year, month, 0).getDate();

    let saturdayCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay(); // 0:日, 1:月, ..., 4:木, 6:土
      const dateStr = AppUI.formatDateKey(year, month, day);

      const isHoliday = !!AppState.holidays[dateStr];

      // 木曜日チェック (dayOfWeek === 4)
      if (dayOfWeek === 4) {
        if (isHoliday) {
          // 祝日は自動除外・アラート
          newMap[dateStr] = {
            active: false,
            ruleMatched: true,
            isHoliday: true,
            reason: `祝日 (${AppState.holidays[dateStr]}) のため自動除外`,
            startTime: '14:30',
            returnTime: '17:30',
            time: '14:30〜17:30'
          };
        } else {
          newMap[dateStr] = {
            active: true,
            ruleMatched: true,
            isHoliday: false,
            reason: '木曜定期利用',
            startTime: '14:30',
            returnTime: '17:30', // デフォルト帰着時間（手入力可能）
            time: '14:30〜17:30'
          };
        }
      }

      // 土曜日チェック (dayOfWeek === 6)
      if (dayOfWeek === 6) {
        saturdayCount++;
        // 隔週土曜日（第1・第3土曜日）
        const isTargetSaturday = (saturdayCount === 1 || saturdayCount === 3);

        if (isTargetSaturday) {
          if (isHoliday) {
            newMap[dateStr] = {
              active: false,
              ruleMatched: true,
              isHoliday: true,
              reason: `祝日 (${AppState.holidays[dateStr]}) のため自動除外`,
              startTime: '10:00',
              returnTime: '16:00',
              time: '10:00〜16:00'
            };
          } else {
            newMap[dateStr] = {
              active: true,
              ruleMatched: true,
              isHoliday: false,
              reason: `第${saturdayCount}土曜定期利用`,
              startTime: '10:00',
              returnTime: '16:00',
              time: '10:00〜16:00'
            };
          }
        }
      }
    }

    return newMap;
  },

  // カレンダーの手動タップでON/OFF切り替え
  toggleDate(dateStr) {
    if (!AppState.dayServiceMap[dateStr]) {
      // ルール外の日を新規にONにする
      AppState.dayServiceMap[dateStr] = {
        active: true,
        ruleMatched: false,
        reason: '手動追加利用',
        startTime: '14:30',
        returnTime: '17:30',
        time: '14:30〜17:30'
      };
    } else {
      AppState.dayServiceMap[dateStr].active = !AppState.dayServiceMap[dateStr].active;
    }
    StorageManager.save();
    AppUI.renderCalendar();
    AppUI.renderWhitespace();
    AppUI.renderFaxPreview();
  },

  // 放デイ利用予定の更新・振替（日付移動）
  moveOrUpdateDayServiceTime(originalDateKey, newDateKey, active, startTime, returnTime, notes) {
    if (!newDateKey) return;

    // 1. 日付が変更された場合（振替）: 旧キーを削除
    const isDateMoved = (originalDateKey && originalDateKey !== newDateKey);
    if (isDateMoved && AppState.dayServiceMap[originalDateKey]) {
      delete AppState.dayServiceMap[originalDateKey];
    }

    // 2. 新しい日付のエントリを作成・更新
    const isSat = new Date(newDateKey).getDay() === 6;
    const defStart = isSat ? '10:00' : '14:30';
    const defReturn = isSat ? '16:00' : '17:30';
    const sTime = startTime || defStart;
    const rTime = returnTime || defReturn;

    const prevEntry = AppState.dayServiceMap[newDateKey] || {};
    AppState.dayServiceMap[newDateKey] = {
      ...prevEntry,
      active: !!active,
      ruleMatched: prevEntry.ruleMatched || false,
      reason: isDateMoved ? `振替利用 (元: ${originalDateKey})` : (prevEntry.reason || (isSat ? '土曜利用' : '平日利用')),
      startTime: sTime,
      returnTime: rTime,
      time: `${sTime}〜${rTime}`,
      notes: notes || ''
    };

    StorageManager.save();
    AppUI.renderAll();

    if (isDateMoved) {
      AppUI.showToast(`🎈 放デイ予定を【${originalDateKey}】から【${newDateKey}】へ振替しました！`, 'success');
    } else {
      AppUI.showToast(`🎈 ${newDateKey} の放デイ設定（${active ? '利用ON・〜' + rTime + '着' : '利用OFF'}）を保存しました！`, 'success');
    }
  },

  // 互換性用エイリアス
  updateDayServiceTime(dateKey, active, startTime, returnTime, notes) {
    this.moveOrUpdateDayServiceTime(dateKey, dateKey, active, startTime, returnTime, notes);
  },

  // 放デイ予定の削除
  deleteDayService(dateKey) {
    if (!dateKey) return;
    if (AppState.dayServiceMap[dateKey]) {
      delete AppState.dayServiceMap[dateKey];
      StorageManager.save();
      AppUI.renderAll();
      AppUI.showToast(`🗑️ ${dateKey} の放デイ予定を削除しました。`, 'info');
    }
  }
};

// ==========================================
// 4. 移動支援ホワイトスペース（空き時間）抽出
// ==========================================
const WhitespaceLogic = {
  // 学校・放デイが入っていない枠を自動計算（★平日放課後の短時間枠をメインに抽出！）
  extractSlots(year, month) {
    const slots = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay(); // 0:日, 1:月, 2:火, 3:水, 4:木, 5:金, 6:土
      const dateStr = AppUI.formatDateKey(year, month, day);

      const isHoliday = !!AppState.holidays[dateStr];
      const dayServiceEntry = AppState.dayServiceMap[dateStr];
      const hasDayService = dayServiceEntry && dayServiceEntry.active;
      const schoolEv = AppState.schoolEvents.find(e => e.date === dateStr);

      // 1. 平日（月〜金）で「放デイがない日」→【平日放課後 短時間枠】として最優先抽出！
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isHoliday) {
        if (!hasDayService) {
          const isEarly = schoolEv && schoolEv.type === 'early';
          const start = isEarly ? (schoolEv.dismissalTime || '11:30') : '15:00';
          const end = '17:30';
          const title = isEarly 
            ? `学校早帰り・短時間枠 (${schoolEv.dismissalTime}下校〜)`
            : `平日放課後 短時間枠 (約2.5時間)`;
          const desc = isEarly
            ? `${schoolEv.title}（早帰り日課のためたっぷり使えます）`
            : `放デイのない平日。近所のお散歩やカフェ等に最適`;

          slots.push({
            id: `slot-${dateStr}-weekday-short`,
            date: dateStr,
            dayOfWeek,
            dayLabel: ['日','月','火','水','木','金','土'][dayOfWeek],
            type: 'weekday-short',
            title,
            defaultStart: start,
            defaultEnd: end,
            desc
          });
        }
      }
      // 2. 日曜日（常に学校休み）→【休日枠（将来の遠出等）】
      else if (dayOfWeek === 0) {
        if (!hasDayService) {
          slots.push({
            id: `slot-${dateStr}-afternoon`,
            date: dateStr,
            dayOfWeek,
            dayLabel: '日',
            type: 'weekend',
            title: '休日 午後枠 (遠出候補)',
            defaultStart: '13:00',
            defaultEnd: '17:00',
            desc: '日曜日の余暇活動・遠出候補枠'
          });
        }
      }
      // 3. 土曜日（放デイのない土曜日）→【土曜フリー枠】
      else if (dayOfWeek === 6 && !isHoliday) {
        if (!hasDayService) {
          slots.push({
            id: `slot-${dateStr}-sat-all`,
            date: dateStr,
            dayOfWeek,
            dayLabel: '土',
            type: 'weekend',
            title: '土曜フリー枠 (放デイなし)',
            defaultStart: '11:00',
            defaultEnd: '16:00',
            desc: '隔週の空き土曜日'
          });
        }
      }
      // 4. 祝日（学校も放デイも休み）
      else if (isHoliday) {
        if (!hasDayService) {
          slots.push({
            id: `slot-${dateStr}-holiday`,
            date: dateStr,
            dayOfWeek,
            dayLabel: '祝',
            type: 'weekend',
            title: `祝日 (${AppState.holidays[dateStr]}) 枠`,
            defaultStart: '13:00',
            defaultEnd: '17:00',
            desc: '祝日のお出かけ枠'
          });
        }
      }
    }

    return slots;
  }
};

// ==========================================
// 5. 学校お便り Gemini API 解析モジュール
// ==========================================
const GeminiParser = {
  // 利用可能なモデル一覧を動的に取得する (ListModels API)
  async listAvailableModels(apiKey) {
    const cleanKey = (apiKey || '').trim();
    if (!cleanKey) return [];

    const versions = ['v1beta', 'v1'];
    for (const ver of versions) {
      try {
        const url = `https://generativelanguage.googleapis.com/${ver}/models?key=${cleanKey}`;
        console.log(`[GeminiParser] Fetching available models via: ${url.replace(cleanKey, 'KEY_HIDDEN')}`);
        const res = await fetch(url);
        if (!res.ok) {
          const errText = await res.text();
          console.warn(`[GeminiParser] ListModels (${ver}) returned HTTP ${res.status}:`, errText);
          continue;
        }

        const data = await res.json();
        if (data && Array.isArray(data.models) && data.models.length > 0) {
          console.log(`[GeminiParser] ListModels (${ver}) found ${data.models.length} models:`, data.models);
          // generateContent をサポートするモデルを抽出
          const suitable = data.models
            .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => {
              const rawName = m.name || '';
              const cleanName = rawName.startsWith('models/') ? rawName.substring(7) : rawName;
              return {
                name: cleanName,
                fullName: rawName,
                displayName: m.displayName || cleanName,
                version: ver
              };
            });

          if (suitable.length > 0) {
            return suitable;
          }
        }
      } catch (err) {
        console.warn(`[GeminiParser] Network error fetching models (${ver}):`, err);
      }
    }
    return [];
  },

  // APIキーの接続テスト（設定モーダル等から呼出）
  async testApiKey(apiKey) {
    const cleanKey = (apiKey || '').trim();
    if (!cleanKey) {
      return { success: false, message: 'APIキーを入力してください。' };
    }

    try {
      // 1. ListModels による利用可能モデル取得
      const models = await this.listAvailableModels(cleanKey);
      if (models.length > 0) {
        const names = models.map(m => m.name).slice(0, 5).join(', ');
        return {
          success: true,
          message: `接続成功！🎉 利用可能なモデル (${models.length}件): ${names}`,
          models
        };
      }

      // 2. ListModels が取得できなかった場合、主要モデルへの直接テスト送信
      const testCandidates = [
        { ver: 'v1beta', model: 'gemini-1.5-flash' },
        { ver: 'v1beta', model: 'gemini-2.0-flash' },
        { ver: 'v1', model: 'gemini-1.5-flash' },
        { ver: 'v1beta', model: 'gemini-2.5-flash' }
      ];

      let lastErrText = '';
      for (const t of testCandidates) {
        const testUrl = `https://generativelanguage.googleapis.com/${t.ver}/models/${t.model}:generateContent?key=${cleanKey}`;
        const res = await fetch(testUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Ping' }] }] })
        });
        if (res.ok) {
          return { success: true, message: `接続成功！🎉 モデル ${t.model} (${t.ver}) で応答を確認しました。` };
        }
        lastErrText = await res.text();
      }

      return {
        success: false,
        message: `接続に失敗しました: ${lastErrText.slice(0, 200)}`
      };
    } catch (e) {
      return { success: false, message: `通信エラー: ${e.message}` };
    }
  },

  async analyzeNotice(file) {
    const apiKey = (AppState.settings.geminiApiKey || '').trim();
    if (!apiKey) {
      alert('設定画面でGemini APIキーを入力してください。またはデモ用サンプルデータをロードします。');
      return this.generateMockExtractedEvents();
    }

    // Base64エンコード
    const base64Data = await this.fileToBase64(file);
    
    // MIMEタイプの判定強化（拡張子フォールバック）
    let mimeType = file.type;
    if (!mimeType) {
      const lower = (file.name || '').toLowerCase();
      if (lower.endsWith('.pdf')) mimeType = 'application/pdf';
      else if (lower.endsWith('.png')) mimeType = 'image/png';
      else if (lower.endsWith('.webp')) mimeType = 'image/webp';
      else mimeType = 'image/jpeg';
    }

    const promptText = `
あなたは特別支援学校（こやの里）のお便り・月間行事予定表の専門解析アシスタントです。
画像またはPDFから、${AppState.currentYear}年${AppState.currentMonth}月の行事予定と下校時間の変動を抽出してください。
特に重要なのは以下の2点です：
1. 「給食なし」「短縮授業」「早帰り」「午前中下校」などの下校時間変更
2. 特別な学校行事（校外学習、授業参観、運動会、代休など）

以下のJSONフォーマットのみを返してください。Markdownのコードブロックは不要です：
[
  {
    "date": "${AppState.currentYear}-${String(AppState.currentMonth).padStart(2, '0')}-05",
    "title": "行事名",
    "dismissalTime": "11:30",
    "type": "early" (通常下校の場合は "normal")
  }
]
`;

    // Google AI Studio REST API 準拠（camelCase: inlineData, mimeType）
    const requestBody = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data.split(',')[1]
              }
            }
          ]
        }
      ]
    };

    // 1. 動的モデル探索: ListModels から実際に利用可能なモデル一覧を取得
    let targetEndpoints = [];
    try {
      const availableModels = await this.listAvailableModels(apiKey);
      if (availableModels.length > 0) {
        // flash系・最新モデルを優先してソート
        const priorityScore = (name) => {
          const n = name.toLowerCase();
          if (n.includes('2.5-flash')) return 100;
          if (n.includes('2.0-flash')) return 90;
          if (n.includes('1.5-flash')) return 80;
          if (n.includes('flash')) return 70;
          if (n.includes('pro')) return 60;
          return 50;
        };
        availableModels.sort((a, b) => priorityScore(b.name) - priorityScore(a.name));
        targetEndpoints = availableModels.map(m => ({
          version: m.version,
          model: m.name,
          url: `https://generativelanguage.googleapis.com/${m.version}/models/${m.name}:generateContent?key=${apiKey}`
        }));
        console.log('[GeminiParser] Resolved available endpoints dynamically:', targetEndpoints);
      }
    } catch (e) {
      console.warn('[GeminiParser] ListModels discovery error:', e);
    }

    // 2. 動的探索で取得できなかった場合のフォールバック候補
    if (targetEndpoints.length === 0) {
      const candidateNames = [
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-2.5-flash',
        'gemini-1.5-flash-8b',
        'gemini-1.5-pro',
        'gemini-pro'
      ];
      for (const ver of ['v1beta', 'v1']) {
        for (const name of candidateNames) {
          targetEndpoints.push({
            version: ver,
            model: name,
            url: `https://generativelanguage.googleapis.com/${ver}/models/${name}:generateContent?key=${apiKey}`
          });
        }
      }
    }

    let lastError = null;

    for (const ep of targetEndpoints) {
      try {
        console.log(`[GeminiParser] Requesting: ${ep.model} (${ep.version})`);
        const response = await fetch(ep.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errBody = await response.text();
          console.warn(`[GeminiParser] Model ${ep.model} (${ep.version}) HTTP ${response.status}:`, errBody);
          lastError = new Error(`モデル ${ep.model} (${ep.version}, HTTP ${response.status}): ${errBody.slice(0, 200)}`);
          // 次の候補を試行
          continue;
        }

        const result = await response.json();
        if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
          throw new Error('Gemini APIの応答にコンテンツが含まれていません。');
        }

        const rawText = result.candidates[0].content.parts[0].text;
        console.log(`[GeminiParser] Successful response with ${ep.model}:`, rawText);

        // JSON抽出（コードブロックの除去および配列部分の切り出し）
        let cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonArrayMatch = cleanJson.match(/\[[\s\S]*\]/);
        if (jsonArrayMatch) {
          cleanJson = jsonArrayMatch[0];
        }

        const events = JSON.parse(cleanJson);
        console.log(`[GeminiParser] Parsed ${events.length} school events successfully.`);
        return events.map((ev, idx) => ({
          id: `gemini-ev-${Date.now()}-${idx}`,
          date: ev.date,
          title: ev.title,
          dismissalTime: ev.dismissalTime || '14:30',
          type: ev.type || 'normal'
        }));
      } catch (e) {
        lastError = e;
        console.warn(`[GeminiParser] Error trying ${ep.model}:`, e);
      }
    }

    console.error('Gemini Scan Failed with all models:', lastError);
    alert(`Gemini解析でエラーが発生したため、デモサンプルデータを適用します:\n${lastError ? lastError.message : 'モデルが見つかりませんでした'}\n\n※設定ボタンから「接続テスト」を実行すると、お使いのAPIキーの有効性と対応モデルを確認できます。`);
    return this.generateMockExtractedEvents();
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  generateMockExtractedEvents() {
    const m = String(AppState.currentMonth).padStart(2, '0');
    return [
      { id: 'm-1', date: `${AppState.currentYear}-${m}-06`, title: '身体計測・通常授業', dismissalTime: '14:30', type: 'normal' },
      { id: 'm-2', date: `${AppState.currentYear}-${m}-13`, title: '校外学習（給食なし・11:30下校）', dismissalTime: '11:30', type: 'early' },
      { id: 'm-3', date: `${AppState.currentYear}-${m}-18`, title: '短縮日課（職員会議のため）', dismissalTime: '13:30', type: 'early' },
      { id: 'm-4', date: `${AppState.currentYear}-${m}-27`, title: 'ふれあい作品展見学', dismissalTime: '14:30', type: 'normal' }
    ];
  }
};

// ==========================================
// 6. 事業所提出用 FAX用紙 描画＆PDF出力
// ==========================================
const FaxPdfRenderer = {
  // A4横比率 (1754 x 1240 px) Canvasに「かいと支援センター 依頼表」を忠実に描画
  renderToCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 白背景クリア
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // ================= 1. 上部タイトル＆注意書き =================
    // 左上: 「依　頼　表」の枠囲みタイトル
    const titleBox = { x: 140, y: 75, width: 360, height: 90 };
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(titleBox.x, titleBox.y, titleBox.width, titleBox.height);
    // 内枠二重線
    ctx.lineWidth = 1;
    ctx.strokeRect(titleBox.x + 4, titleBox.y + 4, titleBox.width - 8, titleBox.height - 8);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 44px "Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", "Hiragino Kaku Gothic ProN", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('依　頼　表', titleBox.x + titleBox.width / 2, titleBox.y + titleBox.height / 2 + 2);

    // 右上: 受付の注意書き文言
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    
    // 1行目: 次月依頼・追加依頼はこの用紙にて Ｆ Ａ Ｘ か 郵送 での受付となります。
    const noticeX = 530;
    const line1Y = 110;
    ctx.font = '22px sans-serif';
    ctx.fillText('次月依頼・追加依頼はこの用紙にて', noticeX, line1Y);
    let curX = noticeX + ctx.measureText('次月依頼・追加依頼はこの用紙にて').width;

    ctx.font = 'bold 25px sans-serif';
    ctx.fillText(' Ｆ Ａ Ｘ ', curX, line1Y);
    curX += ctx.measureText(' Ｆ Ａ Ｘ ').width;

    ctx.font = '22px sans-serif';
    ctx.fillText('か', curX, line1Y);
    curX += ctx.measureText('か').width;

    ctx.font = 'bold 25px sans-serif';
    ctx.fillText(' 郵送 ', curX, line1Y);
    curX += ctx.measureText(' 郵送 ').width;

    ctx.font = '22px sans-serif';
    ctx.fillText('での受付となります。', curX, line1Y);

    // 2行目: 次月依頼は２０日必着となります。ご注意ください。
    const line2Y = 155;
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('次月依頼は２０日必着となります。', noticeX, line2Y);
    const line2Width = ctx.measureText('次月依頼は２０日必着となります。').width;
    ctx.font = '22px sans-serif';
    ctx.fillText('ご注意ください。', noticeX + line2Width + 5, line2Y);

    // ================= 2. ヘッダー記入欄 =================
    const headerY = 242;
    const userName = (document.getElementById('userNameInput') ? document.getElementById('userNameInput').value : '') || AppState.settings.userName || '華佳';
    const targetMonth = AppState.currentMonth;
    const totalPages = (document.getElementById('totalPagesInput') ? document.getElementById('totalPagesInput').value : '1') || '1';
    const currentPage = (document.getElementById('currentPageInput') ? document.getElementById('currentPageInput').value : '1') || '1';
    const meetingPlace = (document.getElementById('meetingPlaceInput') ? document.getElementById('meetingPlaceInput').value : '') || AppState.settings.meetingPlace || '自宅';

    // 左: ご依頼月 ○○ 月分
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ご依頼月', 140, headerY);
    // 月の下線
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(235, headerY + 4);
    ctx.lineTo(345, headerY + 4);
    ctx.stroke();
    // 印字
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(targetMonth), 290, headerY);
    // 「月分」
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('月分', 355, headerY);

    // 中央: お名前 ○○○○ 様
    ctx.fillText('お名前', 520, headerY);
    // 名前の下線
    ctx.beginPath();
    ctx.moveTo(600, headerY + 4);
    ctx.lineTo(960, headerY + 4);
    ctx.stroke();
    // 印字
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(userName, 780, headerY);
    // 「様」
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('様', 975, headerY);

    // 右: 全部で ○ 枚 ○ 枚目
    ctx.font = '18px sans-serif';
    ctx.fillText('全部で', 1100, headerY - 10);
    // 下線
    ctx.beginPath();
    ctx.moveTo(1160, headerY - 7);
    ctx.lineTo(1230, headerY - 7);
    ctx.stroke();
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(totalPages), 1195, headerY - 11);

    ctx.font = '18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('枚', 1240, headerY - 10);
    // 下線
    ctx.beginPath();
    ctx.moveTo(1265, headerY - 7);
    ctx.lineTo(1335, headerY - 7);
    ctx.stroke();
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(currentPage), 1300, headerY - 11);

    ctx.font = '18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('枚目', 1345, headerY - 10);

    // 注釈
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#444444';
    ctx.fillText('２枚以上になる場合は通し番号を記入してください', 1100, headerY + 14);
    ctx.fillStyle = '#000000';

    // ================= 3. データテーブル（表: 6行） =================
    const tableLeft = 140;
    const tableTop = 270;
    const headerHeight = 65;
    const rowHeight = 115;
    const rowCount = 6;
    const totalTableHeight = headerHeight + (rowHeight * rowCount);

    const cols = [
      { id: 'date', name: '依頼日', width: 130, align: 'center' },
      { id: 'dow', name: '曜日', width: 80, align: 'center' },
      { id: 'start', name: '開始時間', width: 145, align: 'center' },
      { id: 'end', name: '終了時間', width: 145, align: 'center' },
      { id: 'place', name: '待ち合わせ場所', width: 220, align: 'center' },
      { id: 'destination', name: '行き先・伝達事項', width: 504, align: 'left' },
      { id: 'helper', name: 'ヘルパー名', width: 250, align: 'center' }
    ];

    const tableWidth = cols.reduce((sum, c) => sum + c.width, 0); // 1474px

    // 表外の左側に行番号 1 〜 6 を描画
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000';
    for (let i = 0; i < rowCount; i++) {
      const rowCenterY = tableTop + headerHeight + (i * rowHeight) + (rowHeight / 2) + 7;
      ctx.fillText(String(i + 1), 115, rowCenterY);
    }

    // 表の外枠
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(tableLeft, tableTop, tableWidth, totalTableHeight);

    // 表ヘッダー文字＆サブテキスト描画
    let colX = tableLeft;
    cols.forEach(col => {
      ctx.textAlign = 'center';
      if (col.id === 'destination') {
        // 行き先・伝達事項
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('行き先・伝達事項', colX + 15, tableTop + 38);

        // ※行き先お任せ頂く場合...
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('※行き先お任せ頂く場合', colX + col.width - 12, tableTop + 27);
        ctx.fillText('には『フリー』とご記入ください。', colX + col.width - 12, tableTop + 48);
      } else if (col.id === 'helper') {
        // ヘルパー名
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('ヘルパー名', colX + col.width / 2, tableTop + 32);
        ctx.font = '12px sans-serif';
        ctx.fillText('記入しないで下さい', colX + col.width / 2, tableTop + 52);
      } else {
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(col.name, colX + col.width / 2, tableTop + 40);
      }
      colX += col.width;
    });

    // 水平区切り線（ヘッダー下線）
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tableLeft, tableTop + headerHeight);
    ctx.lineTo(tableLeft + tableWidth, tableTop + headerHeight);
    ctx.stroke();

    // 割り当てデータ（キャンセル以外の先頭6件）
    const assignments = AppState.mobilityAssignments.filter(m => m.status !== 'cancelled').slice(0, rowCount);

    // データ行の描画
    for (let i = 0; i < rowCount; i++) {
      const rowY = tableTop + headerHeight + (i * rowHeight);
      const item = assignments[i];

      // 横罫線（各行の下線）
      if (i < rowCount - 1) {
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tableLeft, rowY + rowHeight);
        ctx.lineTo(tableLeft + tableWidth, rowY + rowHeight);
        ctx.stroke();
      }

      if (item) {
        // 日付・曜日
        const parts = item.date.split('-');
        const monthNum = parseInt(parts[1], 10);
        const dayNum = parseInt(parts[2], 10);
        const dateText = `${monthNum}月${dayNum}日`;

        const dObj = new Date(parts[0], monthNum - 1, dayNum);
        const dayKanji = ['日', '月', '火', '水', '木', '金', '土'][dObj.getDay()];

        let cellLeft = tableLeft;
        cols.forEach(col => {
          ctx.fillStyle = '#000000';
          if (col.id === 'date') {
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(dateText, cellLeft + col.width / 2, rowY + (rowHeight / 2) + 8);
          } else if (col.id === 'dow') {
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(dayKanji, cellLeft + col.width / 2, rowY + (rowHeight / 2) + 8);
          } else if (col.id === 'start') {
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(item.startTime || '13:00', cellLeft + col.width / 2, rowY + (rowHeight / 2) + 8);
          } else if (col.id === 'end') {
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(item.endTime || '17:00', cellLeft + col.width / 2, rowY + (rowHeight / 2) + 8);
          } else if (col.id === 'place') {
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(meetingPlace, cellLeft + col.width / 2, rowY + (rowHeight / 2) + 8);
          } else if (col.id === 'destination') {
            ctx.textAlign = 'left';
            ctx.font = 'bold 22px sans-serif';
            if (item.remarks) {
              // 2行表示: 行き先 ＋ 備考
              ctx.fillText(item.spotName, cellLeft + 15, rowY + 48, col.width - 30);
              ctx.font = '18px sans-serif';
              ctx.fillStyle = '#333333';
              ctx.fillText(`備考: ${item.remarks}`, cellLeft + 15, rowY + 84, col.width - 30);
            } else {
              // 1行表示
              ctx.fillText(item.spotName, cellLeft + 15, rowY + (rowHeight / 2) + 8, col.width - 30);
            }
          } else if (col.id === 'helper') {
            // ヘルパー名は原本の指示通り空欄
          }
          cellLeft += col.width;
        });
      }
    }

    // 縦罫線
    let verticalX = tableLeft;
    ctx.lineWidth = 1.5;
    for (let c = 1; c < cols.length; c++) {
      verticalX += cols[c - 1].width;
      ctx.beginPath();
      ctx.moveTo(verticalX, tableTop);
      ctx.lineTo(verticalX, tableTop + totalTableHeight);
      ctx.stroke();
    }

    // ================= 4. フッター部 =================
    // 左側: 太い左向き矢印「◀ ＦＡＸ送信方向」
    const arrowTipX = 140;
    const arrowTipY = 1095;
    const arrowHeadW = 55;
    const arrowHeadH = 30; // 上下に30px (計60px)
    const arrowStemX = arrowTipX + arrowHeadW;
    const arrowStemW = 270;
    const arrowStemH = 44; // 太さ

    ctx.fillStyle = '#222222';
    ctx.beginPath();
    // 矢じり
    ctx.moveTo(arrowTipX, arrowTipY);
    ctx.lineTo(arrowStemX, arrowTipY - arrowHeadH);
    ctx.lineTo(arrowStemX, arrowTipY - (arrowStemH / 2));
    // 矢の軸
    ctx.lineTo(arrowStemX + arrowStemW, arrowTipY - (arrowStemH / 2));
    ctx.lineTo(arrowStemX + arrowStemW, arrowTipY + (arrowStemH / 2));
    ctx.lineTo(arrowStemX, arrowTipY + (arrowStemH / 2));
    // 矢じり下部
    ctx.lineTo(arrowStemX, arrowTipY + arrowHeadH);
    ctx.closePath();
    ctx.fill();

    // 矢印内の白抜き文字
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ＦＡＸ送信方向', arrowStemX + (arrowStemW / 2) - 10, arrowTipY + 7);

    // 中央: 有限会社 かいと支援センター 行
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 30px "Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", "Hiragino Kaku Gothic ProN", serif';
    ctx.textAlign = 'center';
    ctx.fillText('有限会社 かいと支援センター 行', 780, arrowTipY + 9);

    // 右側: 四角枠囲み「（ＦＡＸ） ０６－６４３６－０９０９」
    const faxBoxX = 1085;
    const faxBoxY = 1065;
    const faxBoxW = 529;
    const faxBoxH = 62;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    // 角丸枠
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(faxBoxX, faxBoxY, faxBoxW, faxBoxH, 6);
      ctx.stroke();
    } else {
      ctx.strokeRect(faxBoxX, faxBoxY, faxBoxW, faxBoxH);
    }

    ctx.font = 'bold 27px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('（ＦＡＸ） ０６－６４３６－０９０９', faxBoxX + (faxBoxW / 2), faxBoxY + (faxBoxH / 2) + 9);
  },

  // PDFダウンロード処理 (A4横 Landscape: 841.89 x 595.28 pt)
  async downloadPdf(canvas) {
    const userName = (document.getElementById('userNameInput') ? document.getElementById('userNameInput').value : '') || AppState.settings.userName || '華佳';
    const filename = `かいと支援センター依頼表_${AppState.currentYear}年${AppState.currentMonth}月分_${userName}様.pdf`;

    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      
      if (typeof PDFLib === 'undefined') {
        throw new Error('PDFLib がロードされていません。画像としてダウンロードします。');
      }

      const { PDFDocument } = PDFLib;
      const pdfDoc = await PDFDocument.create();
      
      // A4横サイズ (841.89 x 595.28 pt)
      const page = pdfDoc.addPage([841.89, 595.28]);
      const jpgImage = await pdfDoc.embedJpg(dataUrl);

      page.drawImage(jpgImage, {
        x: 0,
        y: 0,
        width: 841.89,
        height: 595.28
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      AppUI.showToast(`「${filename}」をダウンロードしました！`, 'success');
    } catch (e) {
      console.warn('PDF generation error, fallback to PNG download:', e);
      // フォールバック: 画像直接ダウンロード
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `かいと支援センター依頼表_${AppState.currentYear}年${AppState.currentMonth}月分_${userName}様.png`;
      a.click();
      AppUI.showToast(`A4横の高精細画像としてダウンロードしました！`, 'success');
    }
  }
};

// ==========================================
// 7. UIレンダラー & イベントハンドラ
// ==========================================
const AppUI = {
  init() {
    StorageManager.load();
    this.bindEvents();

    // 放デイ予定の初期生成（未登録の場合）
    if (Object.keys(AppState.dayServiceMap).length === 0) {
      AppState.dayServiceMap = DayServiceLogic.calculateSchedule(AppState.currentYear, AppState.currentMonth);
      StorageManager.save();
    }

    this.renderAll();
    lucide.createIcons();
  },

  formatDateKey(year, month, day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  },

  // 当日の学校下校時間（お迎え時間）の判定ロジック
  getDismissalInfo(dateKey, dayOfWeek, isHoliday) {
    // 土日・祝日は下校時間なし
    if (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday) {
      return null;
    }

    // 基本下校時間ルール（水曜は14:00、月・火・木・金は15:00）
    const defaultTime = (dayOfWeek === 3) ? '14:00' : '15:00';

    // その日の学校予定（複数行事に対応）
    const evs = AppState.schoolEvents.filter(e => e.date === dateKey);

    if (evs.length > 0) {
      // 終日休業・代休・創立記念日等のチェック
      const isOff = evs.some(e => 
        e.dismissalTime === '終日休業' || 
        (e.title && (e.title.includes('創立記念日') || e.title.includes('代休') || e.title.includes('休校') || e.title.includes('秋季休業') || e.title.includes('春季休業')))
      );
      if (isOff) {
        return {
          time: '終日休業',
          label: '🎒 終日休業 (学校なし)',
          isAlert: false,
          isOff: true,
          className: 'dismissal-off'
        };
      }

      // 下校時間文字列の抽出（例: '13:00', '14:00', '11:30' など）
      const times = evs
        .map(e => e.dismissalTime)
        .filter(t => t && t !== '通常' && t !== '終日休業' && /^\d{1,2}:\d{2}$/.test(t));

      const hasEarlyFlag = evs.some(e => e.type === 'early');

      let pickedTime = times.length > 0 ? times.sort()[0] : defaultTime;
      const isTimeDifferent = (pickedTime !== defaultTime);

      // 「早帰り・変則」フラグがあるか、または基本下校時間より早い・異なる場合
      if (hasEarlyFlag || isTimeDifferent) {
        return {
          time: pickedTime,
          label: `🎒 ${pickedTime} 下校 ⚠️早帰り!`,
          isAlert: true,
          isOff: false,
          className: 'dismissal-alert'
        };
      }

      // 時間が通常と同じ場合
      if (dayOfWeek === 3) {
        return {
          time: '14:00',
          label: `🎒 14:00 下校 (水曜)`,
          isAlert: false,
          isOff: false,
          className: 'dismissal-wed-normal'
        };
      }

      return {
        time: '15:00',
        label: `🎒 15:00 下校`,
        isAlert: false,
        isOff: false,
        className: 'dismissal-normal'
      };
    }

    // お便りに特記予定がない通常の平日
    if (dayOfWeek === 3) {
      return {
        time: '14:00',
        label: `🎒 14:00 下校 (水曜)`,
        isAlert: false,
        isOff: false,
        className: 'dismissal-wed-normal'
      };
    }

    return {
      time: '15:00',
      label: `🎒 15:00 下校`,
      isAlert: false,
      isOff: false,
      className: 'dismissal-normal'
    };
  },

  // 学校行事・下校時間編集モーダルを開く
  openSchoolEventModal(eventOrDate = null) {
    const modal = document.getElementById('schoolEventModal');
    if (!modal) return;

    if (typeof eventOrDate === 'string') {
      // 日付文字列（YYYY-MM-DD）が渡された場合
      const existing = AppState.schoolEvents.find(e => e.date === eventOrDate);
      if (existing) {
        this.fillSchoolEventModal(existing);
      } else {
        // 当該日の新規作成
        document.getElementById('editSchoolEventId').value = '';
        document.getElementById('editSchoolEventDate').value = eventOrDate;
        document.getElementById('editSchoolEventTitle').value = '';
        const dayOfWeek = new Date(eventOrDate).getDay();
        const defTime = (dayOfWeek === 3) ? '14:00' : '15:00';
        document.getElementById('editSchoolEventTime').value = defTime;
        document.querySelector('input[name="editSchoolEventType"][value="normal"]').checked = true;
        document.getElementById('deleteSchoolEventModalBtn').style.display = 'none';
        this.syncTimeChips(defTime);
      }
    } else if (eventOrDate && eventOrDate.id) {
      // 既存イベントオブジェクトが渡された場合
      this.fillSchoolEventModal(eventOrDate);
    } else {
      // 新規追加（引数なし）
      const defaultDate = `${AppState.currentYear}-${String(AppState.currentMonth).padStart(2, '0')}-10`;
      document.getElementById('editSchoolEventId').value = '';
      document.getElementById('editSchoolEventDate').value = defaultDate;
      document.getElementById('editSchoolEventTitle').value = '';
      document.getElementById('editSchoolEventTime').value = '15:00';
      document.querySelector('input[name="editSchoolEventType"][value="normal"]').checked = true;
      document.getElementById('deleteSchoolEventModalBtn').style.display = 'none';
      this.syncTimeChips('15:00');
    }

    modal.classList.add('open');
    lucide.createIcons();
  },

  fillSchoolEventModal(ev) {
    document.getElementById('editSchoolEventId').value = ev.id || '';
    document.getElementById('editSchoolEventDate').value = ev.date || '';
    document.getElementById('editSchoolEventTitle').value = ev.title || '';
    const dismissalTime = ev.dismissalTime || '15:00';
    document.getElementById('editSchoolEventTime').value = dismissalTime;
    const type = ev.type || 'normal';
    const radio = document.querySelector(`input[name="editSchoolEventType"][value="${type}"]`);
    if (radio) radio.checked = true;
    document.getElementById('deleteSchoolEventModalBtn').style.display = ev.id ? 'inline-block' : 'none';
    this.syncTimeChips(dismissalTime);
  },

  syncTimeChips(currentTime) {
    document.querySelectorAll('#schoolEventModal .time-chip').forEach(c => {
      if (c.dataset.time === currentTime) {
        c.classList.add('selected');
      } else {
        c.classList.remove('selected');
      }
    });
  },

  renderAll() {
    this.renderHeader();
    this.renderCalendar();
    this.renderSchoolEvents();
    this.renderWhitespace();
    this.renderSpots();
    this.renderFaxPreview();
  },

  renderHeader() {
    document.getElementById('displayYear').textContent = AppState.currentYear;
    document.getElementById('displayMonth').textContent = AppState.currentMonth;
    document.getElementById('faxTargetMonth').textContent = AppState.currentMonth;

    const userNameInput = document.getElementById('userNameInput');
    if (userNameInput && AppState.settings.userName) {
      userNameInput.value = AppState.settings.userName;
    }
    const meetingPlaceInput = document.getElementById('meetingPlaceInput');
    if (meetingPlaceInput && AppState.settings.meetingPlace) {
      meetingPlaceInput.value = AppState.settings.meetingPlace;
    }
    const totalPagesInput = document.getElementById('totalPagesInput');
    if (totalPagesInput && AppState.settings.totalPages) {
      totalPagesInput.value = AppState.settings.totalPages;
    }
    const currentPageInput = document.getElementById('currentPageInput');
    if (currentPageInput && AppState.settings.currentPage) {
      currentPageInput.value = AppState.settings.currentPage;
    }
  },

  // カレンダー描画
  renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    const year = AppState.currentYear;
    const month = AppState.currentMonth;

    const firstDay = new Date(year, month - 1, 1).getDay(); // 月の初日の曜日 (0:日)
    const daysInMonth = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();

    let totalDayServiceDays = 0;

    // 前月のはみ出しセル
    for (let i = firstDay - 1; i >= 0; i--) {
      const prevDay = prevMonthDays - i;
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell other-month';
      cell.innerHTML = `
        <div class="cal-day-top">
          <span class="cal-date-num">${prevDay}</span>
        </div>
      `;
      grid.appendChild(cell);
    }

    // 当月のセル
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = this.formatDateKey(year, month, day);
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay();

      const cell = document.createElement('div');
      cell.className = 'cal-day-cell';
      if (dayOfWeek === 0) cell.classList.add('sun');
      if (dayOfWeek === 6) cell.classList.add('sat');

      const isHoliday = !!AppState.holidays[dateKey];
      if (isHoliday) cell.classList.add('holiday');

      // 今日の判定
      const today = new Date();
      if (today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day) {
        cell.classList.add('today');
      }

      // ヘッダー部（日付番号 ＆ 祝日名）
      let topHtml = `
        <div class="cal-day-top">
          <span class="cal-date-num">${day}</span>
          ${isHoliday ? `<span class="holiday-name-label">${AppState.holidays[dateKey]}</span>` : ''}
        </div>
      `;

      // イベントスタック
      let eventsHtml = '<div class="cal-events-stack">';

      // 1. 学校予定バッジ (複数あればすべて表示)
      const schoolEvs = AppState.schoolEvents.filter(e => e.date === dateKey);
      if (schoolEvs.length > 0) {
        schoolEvs.forEach(ev => {
          const badgeClass = ev.type === 'early' ? 'early-dismissal' : 'school-event';
          const timeHint = ev.dismissalTime ? ` [${ev.dismissalTime}下校]` : '';
          eventsHtml += `
            <div class="event-badge ${badgeClass}" data-ev-id="${ev.id}" title="${ev.title}${timeHint} - タップして下校時間・内容を編集" style="cursor: pointer;">
              <span>🏫 ${ev.title}</span>
              <span class="ds-edit-hint">✎</span>
            </div>
          `;
        });
      }

      // 2. 当日の下校時間バッジ（行事名の下に明記・お迎え時間の不安解消）
      const dismissalInfo = this.getDismissalInfo(dateKey, dayOfWeek, isHoliday);
      if (dismissalInfo) {
        if (dismissalInfo.isAlert) {
          cell.classList.add('has-early-dismissal');
        }
        eventsHtml += `
          <div class="cal-dismissal-banner ${dismissalInfo.className}" data-date="${dateKey}" title="当日のスクールバスお迎え時間: ${dismissalInfo.time} - タップして下校時間を修正" style="cursor: pointer;">
            <span>${dismissalInfo.label}</span>
            <span class="ds-edit-hint" style="margin-left:auto; font-size:0.65rem; opacity:0.8;">✎</span>
          </div>
        `;
      }

      // 3. 放デイ トグルバッジ
      const dayService = AppState.dayServiceMap[dateKey];
      if (dayService) {
        if (dayService.active) totalDayServiceDays++;
        
        const activeClass = dayService.active ? 'active' : 'inactive';
        const warningClass = dayService.isHoliday ? 'holiday-warning' : '';
        const retTime = dayService.returnTime || (dayOfWeek === 6 ? '16:00' : '17:30');

        eventsHtml += `
          <div class="day-service-toggle-badge ${activeClass} ${warningClass}" data-date="${dateKey}" title="タップして利用日変更・帰宅時間の変更">
            <div class="ds-badge-content">
              <span>🎈 放デイ</span>
              ${dayService.active ? `<span class="ds-return-time-tag">〜${retTime}着</span>` : ''}
            </div>
            <span class="toggle-status">${dayService.active ? 'ON' : '休'} <span class="ds-edit-hint">✎</span></span>
          </div>
        `;
      } else if (dayOfWeek === 6 && !isHoliday) {
        // 土曜日に放デイが未設定の場合、クイック追加ボタンを表示
        eventsHtml += `
          <button class="cal-add-sat-ds-btn" data-date="${dateKey}" title="土曜日の放デイ利用を追加・振替">
            + 土曜放デイ追加
          </button>
        `;
      }

      // 4. 移動支援 アサイン済みバッジ
      const mob = AppState.mobilityAssignments.find(m => m.date === dateKey);
      if (mob) {
        const st = mob.status || 'requested';
        let stIcon = '📝 ';
        let stLabel = '希望中';
        if (st === 'confirmed') {
          stIcon = '✓ ';
          stLabel = '確定';
        } else if (st === 'cancelled') {
          stIcon = '✕ ';
          stLabel = '見送り';
        }

        eventsHtml += `
          <div class="mobility-badge ${st}" title="移動支援: ${mob.spotName} (${stLabel}) - タップして確認・変更" data-mobid="${mob.id}" data-date="${dateKey}">
            <span>🚙 ${stIcon}${mob.spotName}</span>
          </div>
        `;
      } else if (!dayService && dayOfWeek >= 1 && dayOfWeek <= 5 && !isHoliday) {
        // 放デイのない平日に、ワンタップで平日移動支援（短時間）を追加できるボタン
        eventsHtml += `
          <button class="cal-add-mobility-btn" data-date="${dateKey}" title="放デイのない平日に移動支援(短時間)を登録">
            + 平日移動支援
          </button>
        `;
      }

      eventsHtml += '</div>';

      cell.innerHTML = topHtml + eventsHtml;

      // 学校行事バッジのタップイベント（直接編集モーダルを開く）
      cell.querySelectorAll('.event-badge').forEach(evEl => {
        evEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const evId = evEl.dataset.evId;
          const targetEv = AppState.schoolEvents.find(x => x.id === evId);
          if (targetEv) {
            AppUI.openSchoolEventModal(targetEv);
          } else {
            AppUI.openSchoolEventModal(dateKey);
          }
        });
      });

      // 下校時間バナーのタップイベント（直接編集モーダルを開く）
      const disEl = cell.querySelector('.cal-dismissal-banner');
      if (disEl) {
        disEl.addEventListener('click', (e) => {
          e.stopPropagation();
          AppUI.openSchoolEventModal(dateKey);
        });
      }

      // 放デイバッジのタップイベント（帰着時間・ステータス編集モーダルを開く）
      const badge = cell.querySelector('.day-service-toggle-badge');
      if (badge) {
        badge.addEventListener('click', (e) => {
          e.stopPropagation();
          AppUI.openDayServiceModal(dateKey);
        });
      }

      // 土曜クイック放デイ追加ボタン
      const addSatDsBtn = cell.querySelector('.cal-add-sat-ds-btn');
      if (addSatDsBtn) {
        addSatDsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          AppUI.openDayServiceModal(dateKey);
        });
      }

      // 平日クイック移動支援追加ボタン
      const addMobBtn = cell.querySelector('.cal-add-mobility-btn');
      if (addMobBtn) {
        addMobBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const schoolEv = AppState.schoolEvents.find(ev => ev.date === dateKey);
          const start = (schoolEv && schoolEv.type === 'early') ? (schoolEv.dismissalTime || '11:30') : '15:00';
          AppUI.openAssignModal(dateKey, start, '17:30');
        });
      }

      // 移動支援バッジのタップイベント（カレンダーから直接ステータス変更・編集が可能）
      const mobBadge = cell.querySelector('.mobility-badge');
      if (mobBadge && mob) {
        mobBadge.addEventListener('click', (e) => {
          e.stopPropagation();
          AppUI.openAssignModal(dateKey, mob.startTime, mob.endTime, mob);
        });
      }

      grid.appendChild(cell);
    }

    // 翌月のはみ出しセル（7の倍数に揃える）
    const totalCells = firstDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell other-month';
      cell.innerHTML = `
        <div class="cal-day-top">
          <span class="cal-date-num">${i}</span>
        </div>
      `;
      grid.appendChild(cell);
    }

    document.getElementById('totalDayServiceCount').textContent = totalDayServiceDays;
    lucide.createIcons();
  },

  // 学校予定テーブル描画
  renderSchoolEvents() {
    const tbody = document.getElementById('schoolEventsTableBody');
    tbody.innerHTML = '';

    AppState.schoolEvents.forEach(ev => {
      const tr = document.createElement('tr');
      const isEarly = ev.type === 'early';
      tr.innerHTML = `
        <td><strong>${ev.date}</strong></td>
        <td class="clickable-cell" title="タップして行事名や下校時間を修正" style="cursor: pointer;">
          <span>${ev.title}</span> <span class="ds-edit-hint" style="font-size:0.75rem; color:var(--primary); margin-left:4px;">✎</span>
        </td>
        <td class="clickable-cell" title="タップして下校時間を直接修正" style="cursor: pointer;">
          <span style="font-weight: 700; color: ${isEarly ? '#dc2626' : '#1e293b'};">${ev.dismissalTime} 下校</span>
          <span class="ds-edit-hint" style="font-size:0.75rem; color:var(--primary); margin-left:4px;">✎</span>
        </td>
        <td>
          <span class="badge-status" style="${isEarly ? 'background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;font-weight:800;' : ''}">
            ${isEarly ? '⚠️ 早帰り・変則' : '通常'}
          </span>
        </td>
        <td style="white-space: nowrap;">
          <button class="btn-primary-sm btn-edit-ev" data-id="${ev.id}" style="padding: 4px 10px; font-size: 0.8rem; margin-right: 6px;">
            ✎ 修正
          </button>
          <button class="btn-text-danger btn-delete-ev" data-id="${ev.id}">
            削除
          </button>
        </td>
      `;

      // 修正ボタン
      tr.querySelector('.btn-edit-ev').addEventListener('click', (e) => {
        e.stopPropagation();
        AppUI.openSchoolEventModal(ev);
      });

      // 行事名・下校予定セルのクリック
      tr.querySelectorAll('.clickable-cell').forEach(cell => {
        cell.addEventListener('click', () => {
          AppUI.openSchoolEventModal(ev);
        });
      });

      // 削除ボタン
      tr.querySelector('.btn-delete-ev').addEventListener('click', (e) => {
        e.stopPropagation();
        AppState.schoolEvents = AppState.schoolEvents.filter(x => x.id !== ev.id);
        StorageManager.save();
        AppUI.renderSchoolEvents();
        AppUI.renderCalendar();
        AppUI.renderWhitespace();
        AppUI.showToast(`予定「${ev.title}」を削除しました`, 'info');
      });

      tbody.appendChild(tr);
    });
  },

  // 移動支援ホワイトスペース描画（★平日短時間枠をメイン表示！）
  renderWhitespace(filterType = 'weekday-short') {
    let slots = WhitespaceLogic.extractSlots(AppState.currentYear, AppState.currentMonth);
    const container = document.getElementById('whitespaceSlotsList');
    container.innerHTML = '';

    if (filterType === 'weekday-short') {
      slots = slots.filter(s => s.type === 'weekday-short');
    } else if (filterType === 'weekend') {
      slots = slots.filter(s => s.type === 'weekend');
    }

    let unassignedCount = 0;

    slots.forEach(slot => {
      const assignment = AppState.mobilityAssignments.find(a => a.date === slot.date);
      if (!assignment || assignment.status === 'cancelled') unassignedCount++;

      const div = document.createElement('div');
      div.className = 'slot-item';

      let rightHtml = '';

      if (assignment) {
        const st = assignment.status || 'requested';
        div.classList.add('assigned', st);

        let statusBadgeHtml = '';
        if (st === 'confirmed') {
          statusBadgeHtml = '<span class="status-pill confirmed">✓ 確定</span>';
        } else if (st === 'cancelled') {
          statusBadgeHtml = '<span class="status-pill cancelled">✕ 見送り (在庫復活済)</span>';
        } else {
          statusBadgeHtml = '<span class="status-pill requested">📝 希望中</span>';
        }

        let actionButtonsHtml = '';
        if (st === 'requested') {
          actionButtonsHtml = `
            <button class="btn-status-confirm" data-id="${assignment.id}" title="事業所からOKが出たので確定にする">✓ 確定</button>
            <button class="btn-status-cancel" data-id="${assignment.id}" title="枠が取れず見送り（スポットを未達リストに復活）">✕ 見送り</button>
            <button class="btn-outline-sm edit-assign-btn" data-date="${slot.date}">変更</button>
          `;
        } else if (st === 'confirmed') {
          actionButtonsHtml = `
            <button class="btn-status-revert" data-id="${assignment.id}" title="申請中・回答待ちに戻す">未確定に戻す</button>
            <button class="btn-status-cancel" data-id="${assignment.id}" title="急遽キャンセル/見送り">✕ 見送り</button>
            <button class="btn-outline-sm edit-assign-btn" data-date="${slot.date}">変更</button>
          `;
        } else { // cancelled
          actionButtonsHtml = `
            <button class="btn-status-revert" data-id="${assignment.id}" title="再度希望申請中に戻す">希望中に戻す</button>
            <button class="btn-outline-sm reopen-slot-btn" data-id="${assignment.id}" title="スロットをクリアして別の行き先を割り当てる">空き枠に戻す</button>
          `;
        }

        rightHtml = `
          <div class="slot-assigned-info">
            <div class="slot-assigned-header">
              ${statusBadgeHtml}
              <span>🚙 ${assignment.spotName}</span>
            </div>
            <div class="slot-action-btn-group">
              ${actionButtonsHtml}
            </div>
          </div>
        `;
      } else {
        rightHtml = `
          <button class="btn-primary-sm assign-slot-btn" data-date="${slot.date}" data-start="${slot.defaultStart}" data-end="${slot.defaultEnd}">
            + 行き先を割り当て
          </button>
        `;
      }

      const isWeekdayShort = slot.type === 'weekday-short';
      const typeBadgeHtml = isWeekdayShort 
        ? '<span class="slot-type-badge weekday-short">平日放課後 (短時間)</span>'
        : '<span class="slot-type-badge weekend">休日枠</span>';

      div.innerHTML = `
        <div>
          <div class="slot-date">
            📅 ${slot.date} (${slot.dayLabel})
            ${typeBadgeHtml}
          </div>
          <div class="slot-time"><i data-lucide="clock" class="sm-icon"></i> ${slot.defaultStart} 〜 ${slot.defaultEnd} (${slot.title})</div>
          <div class="text-xs text-muted" style="margin-top:2px;">${slot.desc}</div>
        </div>
        <div>
          ${rightHtml}
        </div>
      `;

      // 割り当てボタンイベント
      const assignBtn = div.querySelector('.assign-slot-btn');
      if (assignBtn) {
        assignBtn.addEventListener('click', () => {
          AppUI.openAssignModal(slot.date, slot.defaultStart, slot.defaultEnd);
        });
      }

      // 確定ボタンイベント
      const confirmBtn = div.querySelector('.btn-status-confirm');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          MobilityManager.confirmAssignment(confirmBtn.dataset.id);
        });
      }

      // 見送りボタンイベント（在庫復活）
      const cancelBtn = div.querySelector('.btn-status-cancel');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          MobilityManager.cancelAssignment(cancelBtn.dataset.id);
        });
      }

      // 未確定/希望中に戻すボタン
      const revertBtn = div.querySelector('.btn-status-revert');
      if (revertBtn) {
        revertBtn.addEventListener('click', () => {
          MobilityManager.revertToRequested(revertBtn.dataset.id);
        });
      }

      // 空き枠に戻すボタン
      const reopenBtn = div.querySelector('.reopen-slot-btn');
      if (reopenBtn) {
        reopenBtn.addEventListener('click', () => {
          MobilityManager.reopenSlot(reopenBtn.dataset.id);
        });
      }

      const editBtn = div.querySelector('.edit-assign-btn');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          AppUI.openAssignModal(slot.date, assignment.startTime, assignment.endTime, assignment);
        });
      }

      container.appendChild(div);
    });

    document.getElementById('unassignedSlotsBadge').textContent = `${unassignedCount}枠空き`;
    lucide.createIcons();
  },

  // お出かけ先ストックDB描画
  renderSpots(filterStatus = 'all', searchQuery = '') {
    const container = document.getElementById('spotsList');
    container.innerHTML = '';

    let filtered = AppState.spots;
    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => s.status === filterStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => s.name.toLowerCase().includes(q) || (s.notes && s.notes.toLowerCase().includes(q)));
    }

    filtered.forEach(spot => {
      const card = document.createElement('div');
      card.className = 'spot-card';
      const isVisited = spot.status === 'visited';

      card.innerHTML = `
        <div>
          <div class="spot-title">${spot.name}</div>
          <div class="spot-meta">
            <span class="spot-tag">${spot.category}</span>
            <span>${spot.notes || '備考なし'}</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span class="spot-status-badge ${spot.status}">
            ${isVisited ? '✓ 行った場所' : '★ 未達・希望'}
          </span>
          <button class="btn-outline-sm toggle-spot-status-btn" title="ステータス切替">
            ${isVisited ? '未達に戻す' : '行った!'}
          </button>
          <button class="btn-text-danger delete-spot-btn" title="削除">&times;</button>
        </div>
      `;

      card.querySelector('.toggle-spot-status-btn').addEventListener('click', () => {
        spot.status = isVisited ? 'unfulfilled' : 'visited';
        StorageManager.save();
        AppUI.renderSpots(filterStatus, searchQuery);
      });

      card.querySelector('.delete-spot-btn').addEventListener('click', () => {
        AppState.spots = AppState.spots.filter(s => s.id !== spot.id);
        StorageManager.save();
        AppUI.renderSpots(filterStatus, searchQuery);
      });

      container.appendChild(card);
    });
  },

  // FAXプレビューCanvas描画
  renderFaxPreview() {
    const canvas = document.getElementById('faxPreviewCanvas');
    if (!canvas) return;
    FaxPdfRenderer.renderToCanvas(canvas);
    const activeAssignments = AppState.mobilityAssignments.filter(m => m.status !== 'cancelled');
    const badge = document.getElementById('assignedCountBadge');
    if (badge) badge.textContent = activeAssignments.length;
  },

  // 割り当てモーダルを開く
  openAssignModal(date, defaultStart, defaultEnd, existingItem = null) {
    const modal = document.getElementById('assignModal');
    document.getElementById('assignSlotDesc').textContent = `${date} の枠に移動支援の行き先を登録`;
    document.getElementById('assignStartTime').value = defaultStart || '13:00';
    document.getElementById('assignEndTime').value = defaultEnd || '17:00';
    
    // スポット一覧のセレクトボックス生成
    const select = document.getElementById('assignSpotSelect');
    select.innerHTML = '';
    AppState.spots.forEach(sp => {
      const opt = document.createElement('option');
      opt.value = sp.id;
      opt.textContent = `${sp.name} [${sp.status === 'unfulfilled' ? '★未達' : '✓訪問済'}]`;
      if (existingItem && (existingItem.spotId === sp.id || existingItem.spotName === sp.name)) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    const statusGroup = document.getElementById('assignStatusGroup');
    if (existingItem) {
      statusGroup.style.display = 'block';
      const curStatus = existingItem.status || 'requested';
      const radio = document.querySelector(`input[name="assignStatusRadio"][value="${curStatus}"]`);
      if (radio) radio.checked = true;
    } else {
      statusGroup.style.display = 'none';
      const radio = document.querySelector('input[name="assignStatusRadio"][value="requested"]');
      if (radio) radio.checked = true;
    }

    const remarksInput = document.getElementById('assignRemarksInput');
    remarksInput.value = existingItem ? (existingItem.remarks || '') : '';

    const clearBtn = document.getElementById('clearAssignBtn');
    if (existingItem) {
      clearBtn.style.display = 'inline-block';
      clearBtn.onclick = () => {
        MobilityManager.reopenSlot(existingItem.id);
        modal.classList.remove('open');
      };
    } else {
      clearBtn.style.display = 'none';
    }

    document.getElementById('confirmAssignBtn').onclick = () => {
      const selectedSpotId = select.value;
      const spotObj = AppState.spots.find(s => s.id === selectedSpotId);
      const startTime = document.getElementById('assignStartTime').value;
      const endTime = document.getElementById('assignEndTime').value;
      const remarks = remarksInput.value;
      const selectedStatus = existingItem 
        ? (document.querySelector('input[name="assignStatusRadio"]:checked')?.value || 'requested')
        : 'requested';

      // 在庫復活ロジック（見送りを選択した場合）
      if (selectedStatus === 'cancelled' && spotObj) {
        spotObj.status = 'unfulfilled';
      }

      // 既存の同日割り当てを更新または新規追加
      AppState.mobilityAssignments = AppState.mobilityAssignments.filter(a => a.date !== date);
      AppState.mobilityAssignments.push({
        id: existingItem ? existingItem.id : `mob-${Date.now()}`,
        date,
        startTime,
        endTime,
        spotId: selectedSpotId,
        spotName: spotObj ? spotObj.name : 'お出かけ',
        remarks,
        status: selectedStatus
      });

      // 日付順にソート
      AppState.mobilityAssignments.sort((a, b) => a.date.localeCompare(b.date));

      StorageManager.save();
      modal.classList.remove('open');
      AppUI.renderAll();

      if (selectedStatus === 'confirmed') {
        AppUI.showToast(`🚙「${spotObj ? spotObj.name : 'お出かけ'}」を【確定】として登録しました！`, 'success');
      } else if (selectedStatus === 'cancelled') {
        AppUI.showToast(`✕ 見送りとして保存しました。行き先「${spotObj ? spotObj.name : ''}」は未達ストックに復活しました✨`, 'warning');
      } else {
        AppUI.showToast(`📝 移動支援の予定を希望登録しました。`, 'info');
      }
    };

    modal.classList.add('open');
  },

  // 放デイ時間・利用日振替編集モーダルを開く
  openDayServiceModal(dateKey) {
    const modal = document.getElementById('dayServiceModal');
    const d = new Date(dateKey);
    const isSat = d.getDay() === 6;

    const item = AppState.dayServiceMap[dateKey] || {
      active: true,
      startTime: isSat ? '10:00' : '14:30',
      returnTime: isSat ? '16:00' : '17:30',
      notes: ''
    };

    const origInput = document.getElementById('dsModalOriginalDateKey');
    if (origInput) origInput.value = dateKey;

    const dateInput = document.getElementById('dsModalDateInput');
    if (dateInput) dateInput.value = dateKey;

    // 土曜日クイック振替チップを生成・描画
    this.renderSaturdayChips(dateKey);

    // ステータスラジオ
    const statusRadio = document.querySelector(`input[name="dsStatusRadio"][value="${item.active ? 'on' : 'off'}"]`);
    if (statusRadio) statusRadio.checked = true;

    // 時間
    const startTimeInput = document.getElementById('dsStartTimeInput');
    const returnTimeInput = document.getElementById('dsReturnTimeInput');
    startTimeInput.value = item.startTime || (isSat ? '10:00' : '14:30');
    returnTimeInput.value = item.returnTime || (isSat ? '16:00' : '17:30');

    // クイックタイムチップの選択状態更新
    document.querySelectorAll('#dayServiceModal .time-chip').forEach(chip => {
      chip.classList.toggle('selected', chip.dataset.time === returnTimeInput.value);
    });

    document.getElementById('dsNotesInput').value = item.notes || '';

    // 削除ボタンの表示制御
    const deleteBtn = document.getElementById('deleteDayServiceBtn');
    if (deleteBtn) {
      deleteBtn.style.display = AppState.dayServiceMap[dateKey] ? 'inline-block' : 'none';
    }

    modal.classList.add('open');
  },

  // 今月の土曜日クイック振替チップを生成
  renderSaturdayChips(currentSelectedDateKey) {
    const container = document.getElementById('dsSaturdayChips');
    if (!container) return;
    container.innerHTML = '';

    const year = AppState.currentYear;
    const month = AppState.currentMonth;
    const daysInMonth = new Date(year, month, 0).getDate();

    let satCount = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      if (d.getDay() === 6) {
        satCount++;
        const dateKey = this.formatDateKey(year, month, day);
        const isCurrent = (dateKey === currentSelectedDateKey);
        const existing = AppState.dayServiceMap[dateKey];
        const isBooked = existing && existing.active && !isCurrent;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `sat-chip ${isCurrent ? 'selected' : ''} ${isBooked ? 'booked' : ''}`;
        btn.dataset.date = dateKey;

        const mm = String(month).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        let note = '';
        if (isBooked) {
          note = ' (利用中)';
        } else if (satCount === 1 || satCount === 3) {
          note = ' ★基本';
        }

        btn.innerHTML = `${mm}/${dd} (第${satCount}土)${note}`;

        btn.addEventListener('click', () => {
          document.querySelectorAll('#dsSaturdayChips .sat-chip').forEach(c => c.classList.remove('selected'));
          btn.classList.add('selected');

          const dateInput = document.getElementById('dsModalDateInput');
          if (dateInput) {
            dateInput.value = dateKey;
          }

          // 土曜日の時間（10:00〜16:00）を自動セット
          const startInput = document.getElementById('dsStartTimeInput');
          const returnInput = document.getElementById('dsReturnTimeInput');
          if (existing && existing.startTime) {
            if (startInput) startInput.value = existing.startTime;
            if (returnInput) returnInput.value = existing.returnTime;
          } else {
            if (startInput) startInput.value = '10:00';
            if (returnInput) returnInput.value = '16:00';
          }

          // 時間クイックチップも同期
          document.querySelectorAll('#dayServiceModal .time-chip').forEach(c => {
            c.classList.toggle('selected', c.dataset.time === returnInput?.value);
          });
        });

        container.appendChild(btn);
      }
    }
  },

  // トースト通知の表示
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'warning') iconName = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${iconName}" class="sm-icon"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  },

  // イベントリスナー紐付け
  bindEvents() {
    // タブ切り替え
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        
        // ターゲットIDの正規化（キャメルケース・ケバブケース両対応）
        let targetId = tab.dataset.tab + 'Tab';
        if (tab.dataset.tab === 'school-scan' || tab.dataset.tab === 'schoolScan') targetId = 'schoolScanTab';
        if (tab.dataset.tab === 'fax-export' || tab.dataset.tab === 'faxExport') targetId = 'faxExportTab';
        if (tab.dataset.tab === 'calendar') targetId = 'calendarTab';
        if (tab.dataset.tab === 'mobility') targetId = 'mobilityTab';

        const targetPane = document.getElementById(targetId);
        if (targetPane) {
          targetPane.classList.add('active');
        }

        if (targetId === 'faxExportTab') {
          AppUI.renderFaxPreview();
        } else if (targetId === 'schoolScanTab') {
          AppUI.renderSchoolEvents();
        } else if (targetId === 'mobilityTab') {
          AppUI.renderWhitespace();
        }
      });
    });

    // 月移動（既存の編集内容を保持）
    document.getElementById('prevMonthBtn').addEventListener('click', () => {
      if (AppState.currentMonth === 1) {
        AppState.currentYear--;
        AppState.currentMonth = 12;
      } else {
        AppState.currentMonth--;
      }
      const monthPrefix = `${AppState.currentYear}-${String(AppState.currentMonth).padStart(2, '0')}`;
      const hasMonthEntries = Object.keys(AppState.dayServiceMap).some(k => k.startsWith(monthPrefix));
      if (!hasMonthEntries) {
        const newMonthEntries = DayServiceLogic.calculateSchedule(AppState.currentYear, AppState.currentMonth);
        AppState.dayServiceMap = { ...AppState.dayServiceMap, ...newMonthEntries };
        StorageManager.save();
      }
      AppUI.renderAll();
    });

    document.getElementById('nextMonthBtn').addEventListener('click', () => {
      if (AppState.currentMonth === 12) {
        AppState.currentYear++;
        AppState.currentMonth = 1;
      } else {
        AppState.currentMonth++;
      }
      const monthPrefix = `${AppState.currentYear}-${String(AppState.currentMonth).padStart(2, '0')}`;
      const hasMonthEntries = Object.keys(AppState.dayServiceMap).some(k => k.startsWith(monthPrefix));
      if (!hasMonthEntries) {
        const newMonthEntries = DayServiceLogic.calculateSchedule(AppState.currentYear, AppState.currentMonth);
        AppState.dayServiceMap = { ...AppState.dayServiceMap, ...newMonthEntries };
        StorageManager.save();
      }
      AppUI.renderAll();
    });

    document.getElementById('todayBtn').addEventListener('click', () => {
      const now = new Date();
      AppState.currentYear = now.getFullYear();
      AppState.currentMonth = now.getMonth() + 1;
      const monthPrefix = `${AppState.currentYear}-${String(AppState.currentMonth).padStart(2, '0')}`;
      const hasMonthEntries = Object.keys(AppState.dayServiceMap).some(k => k.startsWith(monthPrefix));
      if (!hasMonthEntries) {
        const newMonthEntries = DayServiceLogic.calculateSchedule(AppState.currentYear, AppState.currentMonth);
        AppState.dayServiceMap = { ...AppState.dayServiceMap, ...newMonthEntries };
        StorageManager.save();
      }
      AppUI.renderAll();
    });

    // 来月ルール一括適用ボタン
    document.getElementById('autoGenerateDayServiceBtn').addEventListener('click', () => {
      if (confirm(`${AppState.currentYear}年${AppState.currentMonth}月の放デイ基本ルール（木曜＋第1・第3土曜、祝日除外）を一括再適用しますか？\n※現在の月内のカスタム編集・振替内容はリセットされます。`)) {
        const monthPrefix = `${AppState.currentYear}-${String(AppState.currentMonth).padStart(2, '0')}`;
        Object.keys(AppState.dayServiceMap).forEach(k => {
          if (k.startsWith(monthPrefix)) delete AppState.dayServiceMap[k];
        });
        const newMonthEntries = DayServiceLogic.calculateSchedule(AppState.currentYear, AppState.currentMonth);
        AppState.dayServiceMap = { ...AppState.dayServiceMap, ...newMonthEntries };
        StorageManager.save();
        AppUI.renderCalendar();
        AppUI.renderWhitespace();
        AppUI.showToast(`${AppState.currentYear}年${AppState.currentMonth}月の放デイ基本ルールを一括再適用しました！`, 'success');
      }
    });

    // Google / Appleカレンダー (.ics) エクスポートボタン (ヘッダー & カレンダーツールバー)
    const exportIcsHandler = () => IcsExportLogic.downloadIcs();
    const headerExportIcsBtn = document.getElementById('exportIcsBtn');
    if (headerExportIcsBtn) headerExportIcsBtn.addEventListener('click', exportIcsHandler);
    
    const calExportIcsBtn = document.getElementById('calendarExportIcsBtn');
    if (calExportIcsBtn) calExportIcsBtn.addEventListener('click', exportIcsHandler);

    // iCloud 保存 / 読込
    document.getElementById('exportDataBtn').addEventListener('click', () => {
      StorageManager.exportToiCloudJson();
    });

    const fileInput = document.getElementById('importFileInput');
    document.getElementById('importDataBtn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        StorageManager.importFromiCloudJson(e.target.files[0]);
      }
    });

    // モーダル閉じる
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.close;
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('open');
      });
    });

    // 設定モーダル
    document.getElementById('settingsBtn').addEventListener('click', () => {
      document.getElementById('geminiApiKeyInput').value = AppState.settings.geminiApiKey || '';
      const resultBox = document.getElementById('apiKeyTestResult');
      if (resultBox) resultBox.style.display = 'none';
      document.getElementById('settingsModal').classList.add('open');
    });

    // APIキーの表示・非表示切替
    const toggleKeyBtn = document.getElementById('toggleApiKeyVisibilityBtn');
    if (toggleKeyBtn) {
      toggleKeyBtn.addEventListener('click', () => {
        const input = document.getElementById('geminiApiKeyInput');
        if (input.type === 'password') {
          input.type = 'text';
          toggleKeyBtn.innerHTML = '<i data-lucide="eye-off"></i>';
        } else {
          input.type = 'password';
          toggleKeyBtn.innerHTML = '<i data-lucide="eye"></i>';
        }
        lucide.createIcons();
      });
    }

    // APIキー接続テスト
    const testKeyBtn = document.getElementById('testApiKeyBtn');
    if (testKeyBtn) {
      testKeyBtn.addEventListener('click', async () => {
        const keyVal = document.getElementById('geminiApiKeyInput').value.trim();
        const resultBox = document.getElementById('apiKeyTestResult');
        if (!keyVal) {
          resultBox.style.display = 'block';
          resultBox.style.background = '#fef2f2';
          resultBox.style.color = '#991b1b';
          resultBox.style.border = '1px solid #fecaca';
          resultBox.textContent = 'APIキーを入力してください。';
          return;
        }

        testKeyBtn.disabled = true;
        testKeyBtn.innerHTML = '<i data-lucide="loader-2"></i> テスト中...';
        lucide.createIcons();
        resultBox.style.display = 'block';
        resultBox.style.background = '#f0f9ff';
        resultBox.style.color = '#075985';
        resultBox.style.border = '1px solid #bae6fd';
        resultBox.textContent = 'Google APIサーバーに接続中...';

        try {
          const res = await GeminiParser.testApiKey(keyVal);
          if (res.success) {
            resultBox.style.background = '#f0fdf4';
            resultBox.style.color = '#166534';
            resultBox.style.border = '1px solid #bbf7d0';
            resultBox.textContent = res.message;
          } else {
            resultBox.style.background = '#fef2f2';
            resultBox.style.color = '#991b1b';
            resultBox.style.border = '1px solid #fecaca';
            resultBox.textContent = res.message;
          }
        } finally {
          testKeyBtn.disabled = false;
          testKeyBtn.innerHTML = '<i data-lucide="zap"></i> 接続テスト';
          lucide.createIcons();
        }
      });
    }

    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
      AppState.settings.geminiApiKey = document.getElementById('geminiApiKeyInput').value.trim();
      StorageManager.save();
      document.getElementById('settingsModal').classList.remove('open');
      AppUI.showToast('設定を保存しました！', 'success');
    });

    // 放デイ時間モーダル内のクイックタイムチップ
    document.querySelectorAll('#dayServiceModal .time-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#dayServiceModal .time-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        const returnTimeInput = document.getElementById('dsReturnTimeInput');
        if (returnTimeInput) returnTimeInput.value = chip.dataset.time;
      });
    });

    // 放デイ利用日の日付直接入力・変更時の処理
    const dsDateInput = document.getElementById('dsModalDateInput');
    if (dsDateInput) {
      dsDateInput.addEventListener('change', () => {
        const val = dsDateInput.value;
        if (!val) return;
        const d = new Date(val);
        const isSat = d.getDay() === 6;

        // 土曜チップのアクティブ状態更新
        document.querySelectorAll('#dsSaturdayChips .sat-chip').forEach(c => {
          c.classList.toggle('selected', c.dataset.date === val);
        });

        // 土曜・平日に応じたデフォルト時間提案
        const startInput = document.getElementById('dsStartTimeInput');
        const returnInput = document.getElementById('dsReturnTimeInput');
        if (isSat) {
          if (startInput) startInput.value = '10:00';
          if (returnInput) returnInput.value = '16:00';
        } else {
          if (startInput) startInput.value = '14:30';
          if (returnInput) returnInput.value = '17:30';
        }

        // 時間チップの同期
        document.querySelectorAll('#dayServiceModal .time-chip').forEach(c => {
          c.classList.toggle('selected', c.dataset.time === returnInput?.value);
        });
      });
    }

    // 放デイ時間モーダル保存ボタン
    const saveDsBtn = document.getElementById('saveDayServiceTimeBtn');
    if (saveDsBtn) {
      saveDsBtn.addEventListener('click', () => {
        const origKey = document.getElementById('dsModalOriginalDateKey')?.value || '';
        const newDateKey = document.getElementById('dsModalDateInput')?.value || origKey;
        if (!newDateKey) {
          alert('利用日を選択してください');
          return;
        }
        const active = document.querySelector('input[name="dsStatusRadio"]:checked')?.value === 'on';
        const startTime = document.getElementById('dsStartTimeInput')?.value || '';
        const returnTime = document.getElementById('dsReturnTimeInput')?.value || '';
        const notes = document.getElementById('dsNotesInput')?.value.trim() || '';

        DayServiceLogic.moveOrUpdateDayServiceTime(origKey, newDateKey, active, startTime, returnTime, notes);
        document.getElementById('dayServiceModal').classList.remove('open');
      });
    }

    // 放デイ削除ボタン
    const deleteDsBtn = document.getElementById('deleteDayServiceBtn');
    if (deleteDsBtn) {
      deleteDsBtn.addEventListener('click', () => {
        const origKey = document.getElementById('dsModalOriginalDateKey')?.value;
        if (origKey && confirm(`${origKey} の放課後等デイサービスの予定を削除しますか？`)) {
          DayServiceLogic.deleteDayService(origKey);
          document.getElementById('dayServiceModal').classList.remove('open');
        }
      });
    }

    // お出かけ先追加モーダル
    document.getElementById('openAddSpotModalBtn').addEventListener('click', () => {
      document.getElementById('spotNameInput').value = '';
      document.getElementById('spotNotesInput').value = '';
      document.getElementById('spotModal').classList.add('open');
    });

    document.getElementById('saveSpotBtn').addEventListener('click', () => {
      const name = document.getElementById('spotNameInput').value.trim();
      if (!name) return alert('スポット名を入力してください');
      const category = document.getElementById('spotCategorySelect').value;
      const status = document.querySelector('input[name="spotStatus"]:checked').value;
      const notes = document.getElementById('spotNotesInput').value.trim();

      AppState.spots.unshift({
        id: `spot-${Date.now()}`,
        name,
        category,
        status,
        notes
      });
      StorageManager.save();
      document.getElementById('spotModal').classList.remove('open');
      AppUI.renderSpots();
    });

    // お出かけ先ステータスタブ
    document.querySelectorAll('.type-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.type-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        AppUI.renderSpots(btn.dataset.status);
      });
    });

    // お出かけ先検索
    document.getElementById('spotSearchInput').addEventListener('input', (e) => {
      AppUI.renderSpots('all', e.target.value);
    });

    // お便りPDFドラッグ＆ドロップ
    const dropzone = document.getElementById('pdfDropzone');
    const noticeFileInput = document.getElementById('schoolNoticeFileInput');
    dropzone.addEventListener('click', () => noticeFileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        AppUI.handleSelectedNoticeFile(e.dataTransfer.files[0]);
      }
    });
    noticeFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        AppUI.handleSelectedNoticeFile(e.target.files[0]);
      }
    });

    document.getElementById('runGeminiScanBtn').addEventListener('click', async () => {
      const file = AppUI.currentNoticeFile;
      if (!file) return;

      document.getElementById('scanLoadingIndicator').style.display = 'flex';
      document.getElementById('runGeminiScanBtn').disabled = true;

      try {
        const events = await GeminiParser.analyzeNotice(file);
        AppState.schoolEvents = events;
        StorageManager.save();
        AppUI.renderSchoolEvents();
        AppUI.renderCalendar();
        alert('学校予定の解析が完了しました！カレンダーへ反映されました。');
      } finally {
        document.getElementById('scanLoadingIndicator').style.display = 'none';
        document.getElementById('runGeminiScanBtn').disabled = false;
      }
    });

    // お便りクリアボタン
    document.getElementById('clearFileBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      AppUI.currentNoticeFile = null;
      document.getElementById('fileSelectedInfo').style.display = 'none';
      document.getElementById('schoolNoticeFileInput').value = '';
      document.getElementById('runGeminiScanBtn').disabled = true;
    });

    // 空き枠再計算ボタン
    document.getElementById('refreshWhitespaceBtn').addEventListener('click', () => {
      AppUI.renderWhitespace();
    });

    // ホワイトスペースフィルタ切り替え
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const filterType = chip.dataset.filter;
        AppUI.renderWhitespace(filterType);
      });
    });

    // 利用者名・事業所名・待ち合わせ場所・枚数入力のリアルタイム反映
    const userNameInput = document.getElementById('userNameInput');
    if (userNameInput) {
      userNameInput.addEventListener('input', (e) => {
        AppState.settings.userName = e.target.value;
        StorageManager.save();
        AppUI.renderFaxPreview();
      });
    }

    const providerNameInput = document.getElementById('providerNameInput');
    if (providerNameInput) {
      providerNameInput.addEventListener('input', (e) => {
        AppState.settings.providerName = e.target.value;
        StorageManager.save();
        AppUI.renderFaxPreview();
      });
    }

    const meetingPlaceInput = document.getElementById('meetingPlaceInput');
    if (meetingPlaceInput) {
      meetingPlaceInput.addEventListener('input', (e) => {
        AppState.settings.meetingPlace = e.target.value;
        StorageManager.save();
        AppUI.renderFaxPreview();
      });
    }

    const totalPagesInput = document.getElementById('totalPagesInput');
    if (totalPagesInput) {
      totalPagesInput.addEventListener('input', (e) => {
        AppState.settings.totalPages = e.target.value;
        StorageManager.save();
        AppUI.renderFaxPreview();
      });
    }

    const currentPageInput = document.getElementById('currentPageInput');
    if (currentPageInput) {
      currentPageInput.addEventListener('input', (e) => {
        AppState.settings.currentPage = e.target.value;
        StorageManager.save();
        AppUI.renderFaxPreview();
      });
    }

    // 学校行事・下校時間モーダル内のクイックタイムチップ
    document.querySelectorAll('#schoolEventModal .time-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#schoolEventModal .time-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        const timeInput = document.getElementById('editSchoolEventTime');
        if (timeInput) timeInput.value = chip.dataset.time;

        const type = chip.dataset.type || 'normal';
        const radio = document.querySelector(`input[name="editSchoolEventType"][value="${type}"]`);
        if (radio) radio.checked = true;
      });
    });

    // 学校行事・下校時間 保存ボタン
    const saveSchoolEvBtn = document.getElementById('saveSchoolEventModalBtn');
    if (saveSchoolEvBtn) {
      saveSchoolEvBtn.addEventListener('click', () => {
        const id = document.getElementById('editSchoolEventId').value;
        const date = document.getElementById('editSchoolEventDate').value;
        const title = document.getElementById('editSchoolEventTitle').value.trim() || '学校行事';
        const dismissalTime = document.getElementById('editSchoolEventTime').value.trim() || '15:00';
        const type = document.querySelector('input[name="editSchoolEventType"]:checked')?.value || 'normal';

        if (!date) {
          alert('日付を入力してください');
          return;
        }

        if (id) {
          const target = AppState.schoolEvents.find(e => e.id === id);
          if (target) {
            target.date = date;
            target.title = title;
            target.dismissalTime = dismissalTime;
            target.type = type;
          } else {
            AppState.schoolEvents.push({ id, date, title, dismissalTime, type });
          }
        } else {
          AppState.schoolEvents.push({
            id: `ev-${Date.now()}`,
            date,
            title,
            dismissalTime,
            type
          });
        }

        StorageManager.save();
        AppUI.renderSchoolEvents();
        AppUI.renderCalendar();
        AppUI.renderWhitespace();
        document.getElementById('schoolEventModal').classList.remove('open');
        AppUI.showToast(`「${title}」の下校時間を【${dismissalTime}】に更新しました！`, 'success');
      });
    }

    // 学校行事・下校時間 削除ボタン（モーダル内）
    const deleteSchoolEvBtn = document.getElementById('deleteSchoolEventModalBtn');
    if (deleteSchoolEvBtn) {
      deleteSchoolEvBtn.addEventListener('click', () => {
        const id = document.getElementById('editSchoolEventId').value;
        if (id && confirm('この予定を削除しますか？')) {
          AppState.schoolEvents = AppState.schoolEvents.filter(e => e.id !== id);
          StorageManager.save();
          AppUI.renderSchoolEvents();
          AppUI.renderCalendar();
          AppUI.renderWhitespace();
          document.getElementById('schoolEventModal').classList.remove('open');
          AppUI.showToast('予定を削除しました', 'info');
        }
      });
    }

    // 手動で学校予定を追加するボタン（モーダルを開く）
    document.getElementById('addManualSchoolEventBtn').addEventListener('click', () => {
      AppUI.openSchoolEventModal();
    });

    document.getElementById('applySchoolEventsToCalendarBtn').addEventListener('click', () => {
      AppUI.renderCalendar();
      AppUI.renderWhitespace();
      alert('学校予定をカレンダーおよび空き枠計算に最新同期しました！');
    });

    // PDFダウンロードボタン
    document.getElementById('downloadPdfBtn').addEventListener('click', () => {
      const canvas = document.getElementById('faxPreviewCanvas');
      FaxPdfRenderer.downloadPdf(canvas);
    });

    // 印刷ボタン
    document.getElementById('printDirectBtn').addEventListener('click', () => {
      window.print();
    });

    // FAX用紙テンプレート変更（02_システム素材 から選択）
    const changeTemplateBtn = document.getElementById('changeFaxTemplateBtn');
    const faxTemplateInput = document.getElementById('faxTemplateInput');
    if (changeTemplateBtn && faxTemplateInput) {
      changeTemplateBtn.addEventListener('click', () => faxTemplateInput.click());
      faxTemplateInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (event) => {
            AppState.customFaxTemplateDataUrl = event.target.result;
            const statusText = document.getElementById('templateStatusText');
            if (statusText) statusText.textContent = `カスタム用紙適用中 (${file.name})`;
            AppUI.renderFaxPreview();
            AppUI.showToast(`02_システム素材 から「${file.name}」を用紙として読み込みました！`, 'success');
          };
          reader.readAsDataURL(file);
        }
      });
    }
  },

  currentNoticeFile: null,
  handleSelectedNoticeFile(file) {
    this.currentNoticeFile = file;
    document.getElementById('fileSelectedInfo').style.display = 'flex';
    document.getElementById('selectedFileName').textContent = file.name;
    document.getElementById('runGeminiScanBtn').disabled = false;
  }
};

// 起動
document.addEventListener('DOMContentLoaded', () => {
  AppUI.init();
});
