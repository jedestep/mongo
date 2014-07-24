// SERVER-11118 Tests for $dateToString

load('jstests/aggregation/extras/utils.js');

db = db.getSiblingDB("aggdb");

function testFormat(date, formatStr, expectedStr) {
    db.dates.drop();
    db.dates.insert({date: date});

    var res = db.dates.aggregate([{$project: {
        _id: 0,
        formatted: {
            $dateToString: {
                format: formatStr,
                date: "$date"
            }
        }
    }}]).toArray();

    assert.eq(res[0].formatted, expectedStr);
}

function testFormatError(formatObj, errCode) {
    db.dates.drop();
    db.dates.insert({tm: ISODate()});

    assertErrorCode(db.dates, {$project: {
        _id: 0,
        formatted: {
            $dateToString: formatObj
    }}}, errCode);
}

var now = ISODate();

// Use all modifiers we can test with js provided function
testFormat(now,
           "%%-%Y-%m-%d-%H-%M-%S-%L",
           [
               "%",
               now.getUTCFullYear().zeroPad(4),
               (now.getUTCMonth() + 1).zeroPad(2),
               now.getUTCDate().zeroPad(2),
               now.getUTCHours().zeroPad(2),
               now.getUTCMinutes().zeroPad(2),
               now.getUTCSeconds().zeroPad(2),
               now.getUTCMilliseconds().zeroPad(3)
           ].join("-"));


// Padding tests
var padme = ISODate("2001-02-03T04:05:06.007Z");

testFormat(padme, "%%", "%");
testFormat(padme, "%Y", padme.getUTCFullYear().zeroPad(4));
testFormat(padme, "%m", (padme.getUTCMonth() + 1).zeroPad(2));
testFormat(padme, "%d", padme.getUTCDate().zeroPad(2));
testFormat(padme, "%H", padme.getUTCHours().zeroPad(2));
testFormat(padme, "%M", padme.getUTCMinutes().zeroPad(2));
testFormat(padme, "%S", padme.getUTCSeconds().zeroPad(2));
testFormat(padme, "%L", padme.getUTCMilliseconds().zeroPad(3));

// no space and multiple characters between modifiers
testFormat(now,
           "%d%d***%d***%d**%d*%d",
           [
               now.getUTCDate().zeroPad(2),
               now.getUTCDate().zeroPad(2),
               "***",
               now.getUTCDate().zeroPad(2),
               "***",
               now.getUTCDate().zeroPad(2),
               "**",
               now.getUTCDate().zeroPad(2),
               "*",
               now.getUTCDate().zeroPad(2)
           ].join(""));

// JS doesn't have equivalents of these format specifiers
testFormat(ISODate('1999-01-02 03:04:05.006Z'), "%U-%w-%j", "00-7-002");

// Missing date
testFormatError({format: "%Y"}, 18628);

// Missing format
testFormatError({date: "$date"}, 18627);

// Extra field
testFormatError({format: "%Y", date: "$date", extra: "whyamIhere"}, 18534);

// Not an object
testFormatError(["%Y", "$date"], 18629);

// Use invalid modifier at middle of string
testFormatError({format:"%Y-%q", date: "$date"}, 18536);

// Odd number of percent signs at end
testFormatError({format: "%U-%w-%j-%%%", date:"$date"}, 18535);

// Odd number of percent signs at middle
// will get interpreted as an invalid modifier since it will try to use '%A'
testFormatError({format: "AAAAA%%%AAAAAA", date:"$date"}, 18536);

// Format parameter not a string
testFormatError({format: {iamalion: "roar"}, date:"$date"}, 18533);
