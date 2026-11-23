function doPost(e) {
  const params = e && e.parameter ? e.parameter : {};
  const guestName = typeof params.name === "string" ? params.name.trim() : "";
  const dish = params.dish;
  const voteId = params.voteId;
  const countRow = dish === "carrilleras" ? 2 : dish === "bacalao" ? 3 : 0;

  if (
    !countRow
    || !guestName
    || guestName.length > 100
    || typeof voteId !== "string"
    || !/^[a-zA-Z0-9-]{8,100}$/.test(voteId)
  ) {
    return ContentService.createTextOutput("invalid");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheets = prepareGuestSheets(spreadsheet);
    const duplicate = sheets.ids
      .getRange(2, 1, Math.max(sheets.ids.getLastRow() - 1, 1), 1)
      .createTextFinder(voteId)
      .matchEntireCell(true)
      .findNext();

    if (duplicate) {
      return ContentService.createTextOutput("duplicate");
    }

    sheets.ids.appendRow([voteId]);

    const guestRow = getNextGuestRow(sheets.menu);
    const guestCell = sheets.menu.getRange(guestRow, 4, 1, 2);
    guestCell.setNumberFormat("@");
    guestCell.setValues([[toSheetText(guestName), dish]]);

    const countCell = sheets.menu.getRange(countRow, 2);
    countCell.setValue((Number(countCell.getValue()) || 0) + 1);
  } finally {
    lock.releaseLock();
  }

  return ContentService.createTextOutput("ok");
}

function setupGuestSheets() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    prepareGuestSheets(spreadsheet);
  } finally {
    lock.releaseLock();
  }
}

function prepareGuestSheets(spreadsheet) {
  const menu = spreadsheet.getSheetByName("Menu");
  if (!menu) {
    throw new Error('Create a sheet tab named "Menu".');
  }

  let ids = spreadsheet.getSheetByName("Submission IDs");
  if (!ids) {
    ids = spreadsheet.insertSheet("Submission IDs");
  }

  menu.getRange("A1:B1").setValues([["Dish", "Total"]]).setFontWeight("bold");
  menu.getRange("A2:A3").setValues([["Carrilleras"], ["Bacalao"]]);
  menu.getRange("D1:E1").setValues([["Guest name", "Chosen dish"]]).setFontWeight("bold");
  menu.getRange("D:E").setNumberFormat("@");
  menu.setFrozenRows(1);
  menu.setColumnWidth(1, 140);
  menu.setColumnWidth(2, 80);
  menu.setColumnWidth(4, 180);
  menu.setColumnWidth(5, 280);

  ids.getRange("A1").setValue("Vote ID").setFontWeight("bold");
  ids.getRange("A:A").setNumberFormat("@");
  ids.setFrozenRows(1);
  ids.setColumnWidth(1, 240);

  migrateLegacySubmissions(spreadsheet, menu, ids);
  return { menu: menu, ids: ids };
}

function migrateLegacySubmissions(spreadsheet, menu, ids) {
  const legacy = spreadsheet.getSheetByName("Submissions");
  if (!legacy || legacy.getLastRow() < 2 || legacy.getLastColumn() < 1) {
    return;
  }

  const idValues = ids.getLastRow() > 1
    ? ids.getRange(2, 1, ids.getLastRow() - 1, 1).getValues()
    : [];
  const knownIds = new Set(idValues.map((row) => String(row[0])));
  const legacyRows = legacy
    .getRange(2, 1, legacy.getLastRow() - 1, legacy.getLastColumn())
    .getValues();
  const newIds = [];
  const newGuests = [];

  legacyRows.forEach((row) => {
    const voteId = typeof row[0] === "string" ? row[0].trim() : "";
    if (!voteId || knownIds.has(voteId)) {
      return;
    }

    knownIds.add(voteId);
    newIds.push([voteId]);

    const guestName = typeof row[1] === "string" ? row[1].trim() : "";
    const dish = row[2];
    if (guestName && (dish === "carrilleras" || dish === "bacalao")) {
      newGuests.push([toSheetText(guestName), dish]);
    }
  });

  if (newIds.length > 0) {
    ids.getRange(ids.getLastRow() + 1, 1, newIds.length, 1).setValues(newIds);
  }

  if (newGuests.length > 0) {
    const firstGuestRow = getNextGuestRow(menu);
    const guestCells = menu.getRange(firstGuestRow, 4, newGuests.length, 2);
    guestCells.setNumberFormat("@");
    guestCells.setValues(newGuests);
  }
}

function getNextGuestRow(menu) {
  const lastRow = menu.getLastRow();
  if (lastRow < 2) {
    return 2;
  }

  const names = menu.getRange(2, 4, lastRow - 1, 1).getValues();
  let lastGuestIndex = names.length - 1;
  while (lastGuestIndex >= 0 && !names[lastGuestIndex][0]) {
    lastGuestIndex -= 1;
  }

  return lastGuestIndex < 0 ? 2 : lastGuestIndex + 3;
}

function toSheetText(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}
