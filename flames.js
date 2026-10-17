(function (global) {
  "use strict";

  function calculate(name1, name2) {
    if (typeof name1 !== "string" || typeof name2 !== "string" ||
        !name1.trim() || !name2.trim()) {
      throw new Error("Please enter both names.");
    }

    let first = name1.toLowerCase().replace(/[^a-z]/g, "").split("");
    let second = name2.toLowerCase().replace(/[^a-z]/g, "").split("");

    if (first.length === 0 || second.length === 0) {
      throw new Error("Please enter names using English letters (A-Z).");
    }

    // Remove matching letters one occurrence at a time.
    for (let i = 0; i < first.length; i++) {
      const matchIndex = second.indexOf(first[i]);
      if (matchIndex !== -1) {
        first.splice(i, 1);
        second.splice(matchIndex, 1);
        i--;
      }
    }

    const remainingCount = first.length + second.length;
    const meanings = {
      F: "Friends",
      L: "Love",
      A: "Affection",
      M: "Marriage",
      E: "Enemies",
      S: "Siblings"
    };

    // Preserve the original calculator's behavior for zero remaining letters.
    if (remainingCount === 0) {
      return { letter: "S", result: meanings.S, remainingCount: 0 };
    }

    const flames = ["F", "L", "A", "M", "E", "S"];
    let index = 0;

    while (flames.length > 1) {
      index = (index + remainingCount - 1) % flames.length;
      flames.splice(index, 1);
    }

    return {
      letter: flames[0],
      result: meanings[flames[0]],
      remainingCount: remainingCount
    };
  }

  global.FLAMES = Object.freeze({ calculate: calculate });
})(window);
