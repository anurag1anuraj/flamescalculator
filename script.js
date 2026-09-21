        // =====================================================
        // MOBILE MENU
        // =====================================================

        const menuButton =
            document.getElementById("menuButton");

        const mobileMenu =
            document.getElementById("mobileMenu");


        menuButton.addEventListener("click", function () {

            mobileMenu.classList.toggle("hidden");


            const isOpen =
                !mobileMenu.classList.contains("hidden");


            menuButton.setAttribute(
                "aria-expanded",
                isOpen
            );


            if (isOpen) {

                menuButton.innerHTML = `

                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="w-6 h-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor">

                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12" />

                    </svg>

                `;

            } else {

                menuButton.innerHTML = `

                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="w-6 h-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor">

                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 6h16M4 12h16M4 18h16" />

                    </svg>

                `;

            }

        });



        // =====================================================
        // CALCULATE FLAMES
        // =====================================================

        function calculateFlames() {


            const name1 =
                document
                    .getElementById("name1")
                    .value
                    .toLowerCase()
                    .replace(/[^a-z]/g, "");


            const name2 =
                document
                    .getElementById("name2")
                    .value
                    .toLowerCase()
                    .replace(/[^a-z]/g, "");


            const error =
                document.getElementById("error");


            // Validation

            if (!name1 || !name2) {

                error.textContent =
                    "Please enter both names.";

                error.classList.remove("hidden");

                return;

            }


            error.classList.add("hidden");



            // Arrays

            let arr1 = name1.split("");

            let arr2 = name2.split("");



            // Remove common letters

            for (let i = 0; i < arr1.length; i++) {

                const index =
                    arr2.indexOf(arr1[i]);


                if (index !== -1) {

                    arr1.splice(i, 1);

                    arr2.splice(index, 1);

                    i--;

                }

            }



            // Count

            const count =
                arr1.length + arr2.length;



            // FLAMES

            let flames = [

                "F",
                "L",
                "A",
                "M",
                "E",
                "S"

            ];


            let index = 0;



            while (flames.length > 1) {

                index =
                    (index + count - 1) %
                    flames.length;

                flames.splice(index, 1);

            }



            const result =
                flames[0];



            // Result Data

            const results = {


                F: {

                    title: "Friends",

                    emoji: "👫",

                    description:
                        "You two have a strong friendship connection! 🤝"

                },


                L: {

                    title: "Lovers",

                    emoji: "❤️",

                    description:
                        "Looks like there is some romantic chemistry! 💕"

                },


                A: {

                    title: "Affection",

                    emoji: "💕",

                    description:
                        "There is a sweet feeling and affection between you two. 🥰"

                },


                M: {

                    title: "Marriage",

                    emoji: "💍",

                    description:
                        "According to the FLAMES game, marriage vibes! 😄"

                },


                E: {

                    title: "Enemies",

                    emoji: "😈",

                    description:
                        "Oops! The FLAMES game says you may have some rivalry. 😂"

                },


                S: {

                    title: "Siblings",

                    emoji: "👨‍👩‍👧",

                    description:
                        "The game says you have a sibling-like connection. 😄"

                }

            };



            // Display Result

            document
                .getElementById("resultEmoji")
                .textContent =
                results[result].emoji;


            document
                .getElementById("resultTitle")
                .textContent =
                results[result].title;


            document
                .getElementById("resultDescription")
                .textContent =
                results[result].description;


            document
                .getElementById("remainingCount")
                .textContent =
                count;


            document
                .getElementById("result")
                .classList.remove("hidden");



            // Scroll

            document
                .getElementById("result")
                .scrollIntoView({

                    behavior: "smooth",

                    block: "center"

                });

        }



        // =====================================================
        // CREATE FLAMES STORY
        // =====================================================

        function createFlamesStory() {


            const canvas =
                document.createElement("canvas");


            canvas.width = 1080;

            canvas.height = 1920;


            const ctx =
                canvas.getContext("2d");



            // Background

            const gradient =
                ctx.createLinearGradient(
                    0,
                    0,
                    1080,
                    1920
                );


            gradient.addColorStop(
                0,
                "#fff1f7"
            );


            gradient.addColorStop(
                0.5,
                "#ffffff"
            );


            gradient.addColorStop(
                1,
                "#ffe4ef"
            );


            ctx.fillStyle =
                gradient;


            ctx.fillRect(
                0,
                0,
                1080,
                1920
            );



            // Decorative circles

            ctx.fillStyle =
                "rgba(236, 72, 153, 0.08)";


            ctx.beginPath();

            ctx.arc(
                120,
                170,
                170,
                0,
                Math.PI * 2
            );

            ctx.fill();


            ctx.beginPath();

            ctx.arc(
                960,
                1750,
                220,
                0,
                Math.PI * 2
            );

            ctx.fill();



            // Heading

            ctx.textAlign =
                "center";


            ctx.font =
                "bold 72px Arial, sans-serif";


            ctx.fillStyle =
                "#db2777";


            ctx.fillText(
                "🔥 FLAMES 🔥",
                540,
                300
            );



            // Original Names

            const originalName1 =
                document
                    .getElementById("name1")
                    .value
                    .trim();


            const originalName2 =
                document
                    .getElementById("name2")
                    .value
                    .trim();


            ctx.font =
                "bold 52px Arial, sans-serif";


            ctx.fillStyle =
                "#111827";


            let namesText =
                originalName1 +
                " ❤️ " +
                originalName2;


            if (namesText.length > 30) {

                ctx.font =
                    "bold 42px Arial, sans-serif";

            }


            ctx.fillText(
                namesText,
                540,
                520
            );



            // Result Emoji

            const resultEmoji =
                document
                    .getElementById("resultEmoji")
                    .textContent;


            ctx.font =
                "90px Arial, sans-serif";


            ctx.fillText(
                resultEmoji,
                540,
                760
            );



            // Result Title

            const resultTitle =
                document
                    .getElementById("resultTitle")
                    .textContent;


            ctx.font =
                "bold 96px Arial, sans-serif";


            ctx.fillStyle =
                "#ec4899";


            ctx.fillText(
                resultTitle,
                540,
                900
            );



            // Description

            const description =
                document
                    .getElementById("resultDescription")
                    .textContent;


            ctx.fillStyle =
                "#4b5563";


            ctx.font =
                "38px Arial, sans-serif";


            const words =
                description.split(" ");


            const lines = [];


            let line = "";


            words.forEach(function (word) {


                const testLine =
                    line
                        ? line + " " + word
                        : word;


                if (
                    ctx.measureText(testLine).width > 800
                ) {

                    lines.push(line);

                    line = word;

                } else {

                    line = testLine;

                }

            });


            if (line) {

                lines.push(line);

            }


            lines
                .slice(0, 3)
                .forEach(function (text, i) {

                    ctx.fillText(
                        text,
                        540,
                        1010 + (i * 55)
                    );

                });



            // Divider

            ctx.beginPath();

            ctx.moveTo(
                250,
                1220
            );

            ctx.lineTo(
                830,
                1220
            );


            ctx.strokeStyle =
                "#f9a8d4";


            ctx.lineWidth = 4;


            ctx.stroke();



            // Remaining Count

            const count =
                document
                    .getElementById("remainingCount")
                    .textContent;


            ctx.font =
                "32px Arial, sans-serif";


            ctx.fillStyle =
                "#9ca3af";


            ctx.fillText(
                "FLAMES remaining letters: " + count,
                540,
                1320
            );



            // Website

            ctx.font =
                "bold 38px Arial, sans-serif";


            ctx.fillStyle =
                "#374151";


            ctx.fillText(
                "Check your result at",
                540,
                1540
            );


            ctx.font =
                "bold 50px Arial, sans-serif";


            ctx.fillStyle =
                "#db2777";


            ctx.fillText(
                "flamescalculator.online",
                540,
                1610
            );



            // Footer

            ctx.font =
                "30px Arial, sans-serif";


            ctx.fillStyle =
                "#9ca3af";


            ctx.fillText(
                "❤️ Fun • Love • Friendship • FLAMES",
                540,
                1770
            );


            return canvas;

        }



        // =====================================================
        // DOWNLOAD STORY
        // =====================================================

        function downloadFlamesStory() {


            const canvas =
                createFlamesStory();


            const link =
                document.createElement("a");


            link.download =
                "flames-result-story.png";


            link.href =
                canvas.toDataURL("image/png");


            link.click();

        }



        // =====================================================
        // SHARE RESULT
        // =====================================================

        async function shareFlamesResult() {


            const canvas =
                createFlamesStory();


            canvas.toBlob(
                async function (blob) {


                    const file =
                        new File(
                            [blob],
                            "flames-result-story.png",
                            {
                                type: "image/png"
                            }
                        );


                    if (
                        navigator.share &&
                        navigator.canShare &&
                        navigator.canShare({
                            files: [file]
                        })
                    ) {


                        try {


                            await navigator.share({

                                title:
                                    "My FLAMES Result ❤️",

                                text:
                                    "Check out my FLAMES result!",

                                files:
                                    [file]

                            });


                        } catch (error) {

                            console.log(
                                "Share cancelled."
                            );

                        }


                    } else {


                        const link =
                            document.createElement("a");


                        link.download =
                            "flames-result-story.png";


                        link.href =
                            URL.createObjectURL(blob);


                        link.click();


                        setTimeout(function () {

                            URL.revokeObjectURL(
                                link.href
                            );

                        }, 1000);


                        alert(
                            "Your FLAMES Story image has been downloaded! ❤️"
                        );

                    }

                },
                "image/png"
            );

        }



        // =====================================================
        // RESET
        // =====================================================

        function resetGame() {


            document
                .getElementById("name1")
                .value = "";


            document
                .getElementById("name2")
                .value = "";


            document
                .getElementById("result")
                .classList.add("hidden");


            document
                .getElementById("error")
                .classList.add("hidden");


            document
                .getElementById("name1")
                .focus();

        }



        // =====================================================
        // ENTER KEY
        // =====================================================

        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Enter"
                ) {

                    calculateFlames();

                }

            }
        );