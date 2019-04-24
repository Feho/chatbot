// ==UserScript==
// @name        Dindon-Slacklibre
// @namespace   Diolide
// @description ChatBot
// @include     https://slacklibre.slack.com/*
// @version     1
// @grant       none
// ==/UserScript==

//======================================================
// TODO :
// - empêcher le bot de répéter le dernier message qu'il a envoyé
// - augmenter les chances de réponse si son nom apparaît dans un message ?
//======================================================

// API Slack
var slackApiUrl = "https://slack.com/api/chat.postMessage?token={{token}}&channel={{channel}}&text={{message}}&username={{username}}&pretty=1"
var slackApiToken = "yourToken";
var channel = "general";
var username = "dindon";

// API Google
var googleApiKey = "yourApiKey";
var googleApiCx = "yourApiCx";

// Définition des sélecteurs CSS des différents élements de la fenêtre de conversation
var messagesSelector = ".message_body";
var messageInputSelector = ".with-emoji-menu";
var messageFormSelector = "#msg_form";
var messageSenderSelector = ".message_sender";
var participantsSelector = ".channel_page_member_row";
var unreadChannelSelector = "#channel-list .unread .overflow_ellipsis";

// Mémorise le dernier message de la conversation pour que le bot
// n'envoie pas de message dès l'activation
var lastMessage = jQuery(messagesSelector).last().text();

var restaurants = {
    "friday" : [
        "Au Rivoli"
    ],
    "others" : [
        "Au Rivoli",
        "Au Lustelle",
        "À l'hotel de France, ils ont des lits mais ils font aussi a bouffer les cons.",
        "À la Grandre Brasserie de l'Impératr.... putain ça me fait chier de tout écrire",
        "Au Toscana, même pas en rêve y a pas de bières",
        "Au JB's Pub mais faut réserver avant 11H !",
        "Ici mais on va chercher un sandwich toytoy",
        "Ici mais des gamelles donc si vous en avez pas, allez pourrir !",
	    "On mange pas."
    ]
};

/**
 * Constructeur du bot.
 *
 * @param {Object} options Contient les paramètres du bot.
 */
function Bot(options)
{
    this.options = options;
    this.active = false;
    this.standby = false;
    this.answered = false;
    this.lastAnswerIndex = null;
    this.lastAnswer = null;
    this.messageBeforeAnswer = null;
    this.secondsSinceLastMessage = 0;
    this.hasAskedAQuestion = false;
    this.commands = [
        { commandText: "-r ", method: this.replaceLastAnswer.bind(this) },
        { commandText: "-a ", method: this.addAnswer.bind(this) },
        { commandText: "@bot sleep", method: this.sleep.bind(this) },
        { commandText: "@dindon sleep", method: this.sleep.bind(this) },
        { commandText: "@bot wake up", method: this.wakeUp.bind(this) },
        { commandText: "@dindon wake up", method: this.wakeUp.bind(this) }
    ];
}

// Définition des méthodes du bot
Bot.prototype = {
    constructor: Bot,

    /**
     * Démarre le bot.
     */
    start: function()
    {
        this.active = true;
        var callbacks = [
            this.whoIs.bind(this),
            this.whereDoWeEat.bind(this),
            this.thisOrThat.bind(this),
            this.taunt.bind(this),
            this.discuss.bind(this),
            this.answerYesNo.bind(this),
            this.search.bind(this),
            this.repeatLastWord.bind(this)
        ]

        setTimeout(this.AnimateDiscussionWhenNoActivity.bind(this), 1000);
        setTimeout(this.sayPause.bind(this), 900000);
        this.monitorNewMessage(callbacks);
        //this.monitorUnreadChannels();
        console.log("Bot started !");
    },

    /**
     * Stoppe le bot.
     */
    stop: function()
    {
        this.active = false;
        console.log("Bot stopped");
    },

    /**
     * Met le bot en veille. Il ne parle plus mais continue à enregistrer les messages.
     */
    sleep: function()
    {
        this.standby = true;
        var message = "Bonne nuit !";
        console.log(message);
        this.sendMessage(message);
    },

    /**
     * Réveille le bot. Il peut parler à nouveau.
     */
    wakeUp: function()
    {
        this.standby = false;
        var message = "Coucou !";
        console.log(message);
        this.sendMessage(message);
    },

    /**
     * Envoie un message ou une question dans la conversation après un certain temps d'inactivité.
     */
    AnimateDiscussionWhenNoActivity: function()
    {
        var that = this;

        if (!that.active)
            return;

        var messages = getMessagesFromCache();

        if (messages == null)
            return;

        if (!that.standby)
        {
            if (that.secondsSinceLastMessage > that.options.autoPostMessageAfterInactivity)
            {
                that.secondsSinceLastMessage = 0;
                var random = getRandomInt(0, 4);

                if (random == 0 && !lastMessage.endsWith("?"))
                {
                    // Recherche d'un message sans lien avec le dernier message pour relancer la conversation
                    var regExpressions = [
                        new RegExp(/^Vous .+$/i),
                        new RegExp(/^(Et )?au fait.*$/i),
                        new RegExp(/([^a-z]mick[^a-z]|[^a-z]rom[^a-z]|romain|[^a-z]myk[^a-z]|mykeul|flo[^a-z]|florian|canard|coin-coin|coin coin|maksim|[^a-z]max[^a-z]|maxime|[^a-z]manu[^a-z]|emmanuel|claire|guillaume|guillaumelanga|guigui|geoffrey|geogeo|[^a-z]geo[^a-z]|feho|juju|tuveuxuntnr)/i),
                        new RegExp(/^(qui|c'est qui) .+\?$/i),
                        new RegExp(/^(tain|tin|ptin|ptain|putain|putin) .+$/i),
                        new RegExp(/^Alors .+\?$/i),
                        new RegExp(/^Comment .+\?$/i)
                    ];

                    var messagesIndexes = [];

                    messages.forEach(function(message, index)
                    {
                        for (var i = 0; i < regExpressions.length; i++)
                        {
                            if (regExpressions[i].test(message))
                            {
                                messagesIndexes.push(index);

                                break;
                            }
                        }
                    });

                    if (messagesIndexes.length > 0)
                    {
                        var random = getRandomInt(0, messagesIndexes.length - 1);
                        that.sendMessage(messages[messagesIndexes[random]]);
                        cacheMessage(messages[messagesIndexes[random]]);
                    }
                }
                else
                {
                    // Stocke les 3 messages précédant le dernier message
                    var contextMessages = [
                        messages[messages.length - 2],
                        messages[messages.length - 3],
                        messages[messages.length - 4]
                    ];

                    // Le bot va tenter une réponse cohérente
                    var oldDiscussionProbability = that.options.discussionProbability;
                    that.options.discussionProbability = 100;
                    that.discuss(lastMessage, contextMessages);
                    that.options.discussionProbability = oldDiscussionProbability;
                }
            }
        }

        that.secondsSinceLastMessage++;
        setTimeout(that.AnimateDiscussionWhenNoActivity.bind(that), 1000)
    },

    /**
     * Surveille l'apparition d'un nouveau message et exécute la commande ou les callbacks.
     *
     * @param  {Array.<Function>} callbacks Contient les méthodes à exécuter pour le message.
     */
    monitorNewMessage: function(callbacks)
    {
        var that = this;

        if (!that.active)
            return;

        var $messages = jQuery(messagesSelector);
        var message = $messages.last().text();

        if (message != lastMessage)
        {
            // debugger;
            lastMessage = message;
            that.answered = false;
            var isCommand = false;

            // Ignore les messages commençant par un double tiret
            if (message.indexOf("--") !== 0)
            {
                that.commands.forEach(function(command)
                {
                    if (message.indexOf(command.commandText) === 0)
                    {
                        command.method(message, command.commandText);
                        isCommand = true;
                    }
                });

                if (!isCommand)
                {
                    cacheMessage(message);

                    if (!that.standby)
                    {
                        var sender = jQuery(messageSenderSelector).last().text();

                        // Stocke les 3 messages précédant le message actuel
                        var contextMessages = [
                            $messages[$messages.length - 2].innerHTML,
                            $messages[$messages.length - 3].innerHTML,
                            $messages[$messages.length - 4].innerHTML
                        ];

                        callbacks.forEach(function(callback)
                        {
                            if (!that.answered)
                            {
                                callback(message, contextMessages, sender);
                            }
                        });
                    }
                }
            }
        }

        setTimeout(function()
        {
            that.monitorNewMessage(callbacks);
        }, 1000);
    },

    /**
     * Détecte si un channel contient des nouveaux messages.
     */
    monitorUnreadChannels: function()
    {
        var that = this;

        if (!that.active)
            return;

        //jQuery("#channel-list .unread").first().removeClass("unread")

        setTimeout(function()
        {
            that.monitorUnreadChannels();
        }, 1000);
    },

    /**
     * Envoie un message dans le chat.
     *
     * @param  {string} message
     */
    sendMessage: function(message)
    {
        var that = this;
        var randomMilliseconds = getRandomInt(2000, 3500);
        that.answered = true;

        setTimeout(function()
        {
            var apiUrl = slackApiUrl.replace("{{token}}", slackApiToken)
                .replace("{{channel}}", channel)
                .replace("{{username}}", username)
                .replace("{{message}}", encodeURIComponent(message));

            httpGetAsync(apiUrl, function(data)
            {
                // console.log(message);
                lastMessage = message;

                if (message.indexOf("?") !== -1)
                {
                    that.hasAskedAQuestion = true;
                }
            });
        }, randomMilliseconds);
    },

    repeatLastWord: function(message)
    {
        var that = this;
        var random = getRandomInt(1, 100);
        // console.log(random);

        if (!that.options.repeatLastWord ||
            (that.options.randomRepeatLastWord && random > that.options.repetitionProbability))
            return;

        var words = message.split(" ");
        var lastWord = words[words.length - 1];

        if (lastWord.length > 1)
        {
            random = getRandomInt(0, that.options.messagePatterns.length - 1);
            var answer = that.options.messagePatterns[random].replace("{{word}}", lastWord);
            that.sendMessage(answer);
            cacheMessage(answer);
        }
    },

    /**
     * Effectue une recherche sur Google et envoie le premier lien trouvé.
     */
    search: function(message)
    {
        var that = this;
        var pattern = /c'?est quoi (.+) *\?/i
        var matches = message.match(pattern);

        if (matches != null)
        {
            var keywords = matches[1].trim();
            var key = googleApiKey;
            var cx = googleApiCx;
            var request = "https://www.googleapis.com/customsearch/v1?q=" + keywords + "&cx=" + cx + "&key=" + key;

            httpGetAsync(request, function(data)
            {
                that.sendMessage(JSON.parse(data).items[0].link);
            });
        }
    },

    /**
     * Répond à une question du style "C'est qui le... ?" par le nom d'un participant aléatoire.
     */
    whoIs: function(message)
    {
        var that = this;
        var pattern = /((qui|ki) (c |ça|ca|c'?est|est( |-)ce)|(c|c'?est) (qui|ki)|qui (est|a) .+\?)/i
        var regex = new RegExp(pattern);

        if (regex.test(message))
        {
            var participants = getParticipants();

            if (participants.length > 0)
            {
                participants.push("toi");
                participants.push("moi");
                var random = getRandomInt(0, participants.length - 1);
                that.sendMessage(participants[random]);
                cacheMessage(participants[random]);
            }
        }
    },

    /**
     * Répond à une question du style "On mange où ?" par le nom d'un restaurant aléatoire.
     */
    whereDoWeEat: function(message)
    {
        var that = this;
        var pattern = /(O(u|ù) est(-| )ce qu'?on mange|On mange o(u|ù))/i
        var regex = new RegExp(pattern);

        if (regex.test(message))
        {
            var numberOfDay = new Date().getDay();
            var restos = null;

            if (numberOfDay == 5) // vendredi
            {
                restos = restaurants.friday;
            }
            else
            {
                restos = restaurants.others;
            }

            var random = getRandomInt(0, restos.length - 1);
            that.sendMessage(restos[random]);
            cacheMessage(restos[random]);
        }
    },

    taunt: function(message, contextMessages, sender)
    {
        var that = this;

        if (sender.toLowerCase() == "mykeul" && message.toLowerCase().indexOf("flemme") !== -1)
        {
            var answer = "t'es un branleur";
            that.sendMessage(answer);
            cacheMessage(answer);
        }
    },

    /**
     * Répond à une question du style "Est-ce que ... ?" par une réponse positive ou négative.
     */
    answerYesNo: function(message)
    {
        var that = this;
        var pattern = /est(-| )ce qu/i
        var regex = new RegExp(pattern);

        if (regex.test(message))
        {
            var answers = [
                "Oui",
                "Oui",
                "Oui",
                "Oui",
                "Non",
                "Non",
                "Non",
                "Non",
                "Bien sûr",
                "Bah non",
                "Carrément",
                "Ou pas",
                "Yeah ;)",
                "Yeah",
                "Nope",
                "Yep",
                "Euh non",
                "Je sais pas ^^",
                "Probablement",
                "J'crois pas non",
                "Évidemment",
                "Probablement pas",
                "Certainement",
                "Certainement pas",
                "Ouais",
                "Ouais",
                "Ouais",
                "Ouais",
                "Nan",
                "Nan",
                "Nan",
                "Nan",
                "Yes",
                "No"
            ];

            var random = getRandomInt(0, answers.length - 1);
            that.sendMessage(answers[random]);
            cacheMessage(answers[random]);
        }
    },

    /**
     * Signale le moment de prendre une pause.
     */
    sayPause: function()
    {
        var that = this;

        if (!that.active)
            return;

        if (!that.standby)
        {
            var dateTimeNow = new Date();
            var minutes = dateTimeNow.getMinutes();

            if (dateTimeNow.getHours() == 15 && 25 <= minutes && minutes < 40)
            {
                that.sendMessage("Pause ?");
                cacheMessage("Pause ?");
            }
        }

        setTimeout(that.sayPause.bind(that), 900000);
    },

    /**
     * Effectue un choix entre 2 mots (sans espaces, ex: "mot1 ou mot2 ?").
     */
    thisOrThat: function(message)
    {
        var that = this;
        var pattern = /^([^ ]+) ou ([^ ]+) *\?$/i
        var matches = message.match(pattern);

        if (matches != null)
        {
            random = getRandomInt(1, 2);
            that.sendMessage(matches[random]);
            cacheMessage(matches[random]);
        }
    },

    /**
     * Permet de répondre au dernier message en fonction du contexte.
     */
    discuss: function(message, contextMessages)
    {
        var that = this;
        var random = getRandomInt(1, 100);

        var canSpeak = (that.options.discuss
            && jQuery(messagesSelector).last().closest('.pj').length == 0
            && (random <= that.options.discussionProbability || message.indexOf("@bot ") === 0
                || message.indexOf("@dindon ") === 0))

        if (!canSpeak)
        {
            return;
        }

        var messages = getMessagesFromCache();

        if (messages == null)
            return;

        var answersIndexes = [];
        var nextMessageIndex = 0;
        var messagesLength = messages.length;

        for (var i = 0; i < messagesLength - 1; i++)
        {
            if (sanitize(messages[i]) == sanitize(message))
            {
                nextMessageIndex = i + 1;

                // debugger;
                var score = that.getScore(message, messages[nextMessageIndex], 10, 20);
                score += that.getScore(contextMessages[0], messages[nextMessageIndex], 40, 40);
                score += that.getScore(contextMessages[1], messages[nextMessageIndex], 20, 20);
                score += that.getScore(contextMessages[2], messages[nextMessageIndex], 10, 10);

                if (i > 0)
                {
                    score += that.getScore(contextMessages[0], messages[i - 1], 40, 40);
                    score += that.getScore(contextMessages[1], messages[i - 1], 20, 20);
                    score += that.getScore(contextMessages[2], messages[i - 1], 10, 10);
                }

                if (i > 1)
                {
                    score += that.getScore(contextMessages[0], messages[i - 2], 20, 20);
                    score += that.getScore(contextMessages[1], messages[i - 2], 10, 10);
                    score += that.getScore(contextMessages[2], messages[i - 2], 5, 5);
                }

                if (i > 2)
                {
                    score += that.getScore(contextMessages[0], messages[i - 3], 10, 10);
                    score += that.getScore(contextMessages[1], messages[i - 3], 5, 5);
                    score += that.getScore(contextMessages[2], messages[i - 3], 2, 2);
                }

                answersIndexes.push({ index: nextMessageIndex, score: score });
            }
        }

        random = getRandomInt(1, 3)

        if (answersIndexes.length === 0 && (random == 1 || message.indexOf("@bot ") === 0
            || message.indexOf("@dindon ") === 0))
        {
            // Aucune réponse trouvée, recherche d'une réponse probable de temps en temps :)
            console.log("Recherche d'un message similaire...");
            var messagesIndexes = [];

            // recherche d'un message se rapprochant le plus du message actuel
            for (var i = 0; i < messagesLength - 1; i++)
            {
                var score = that.getScore(message, messages[i], 0, 0);
                messagesIndexes.push({ index: i, score: score });
            }

            var indexesWithBestScore = that.getIndexesWithBestScore(messagesIndexes);

            for (var i = 0; i < indexesWithBestScore.length; i++)
            {
                messageIndex = indexesWithBestScore[i].index;
                nextMessageIndex = messageIndex + 1;

                // debugger;
                var score = that.getScore(message, messages[nextMessageIndex], 10, 20);
                score += that.getScore(contextMessages[0], messages[nextMessageIndex], 40, 40);
                score += that.getScore(contextMessages[1], messages[nextMessageIndex], 20, 20);
                score += that.getScore(contextMessages[2], messages[nextMessageIndex], 10, 10);

                if (messageIndex > 0)
                {
                    score += that.getScore(contextMessages[0], messages[messageIndex - 1], 40, 40);
                    score += that.getScore(contextMessages[1], messages[messageIndex - 1], 20, 20);
                    score += that.getScore(contextMessages[2], messages[messageIndex - 1], 10, 10);
                }

                if (messageIndex > 1)
                {
                    score += that.getScore(contextMessages[0], messages[messageIndex - 2], 20, 20);
                    score += that.getScore(contextMessages[1], messages[messageIndex - 2], 10, 10);
                    score += that.getScore(contextMessages[2], messages[messageIndex - 2], 5, 5);
                }

                if (messageIndex > 2)
                {
                    score += that.getScore(contextMessages[0], messages[messageIndex - 3], 10, 10);
                    score += that.getScore(contextMessages[1], messages[messageIndex - 3], 5, 5);
                    score += that.getScore(contextMessages[2], messages[messageIndex - 3], 2, 2);
                }

                answersIndexes.push({ index: nextMessageIndex, score: score });
            }
        }

        if (answersIndexes.length > 0)
        {
            var answerIndex = null;

            if (that.options.proposeSuggestions)
            {
                var suggestions = that.getSuggestions(answersIndexes, messages);
                answerIndex = prompt("Choisir une réponse :\n" + suggestions.join("\n"));

                if (answerIndex == null)
                {
                    // L'utilisateur a cliqué sur annuler, aucun message ne sera envoyé
                    return;
                }
            }

            if (answerIndex == null || answerIndex == "")
            {
                // Le mode suggestions est désactivé ou bien l'utilisateur a validé le prompt sans valeur,
                // on sélectionne un des messages avec le score le plus élevé
                var indexesWithBestScore = that.getIndexesWithBestScore(answersIndexes);
                var random = getRandomInt(0, indexesWithBestScore.length - 1);
                answerIndex = indexesWithBestScore[random].index;
                console.log("score index : " + indexesWithBestScore[random].score);
            }

            var answer = messages[answerIndex];

            // Remplace la chaîne "dindon" par le nom d'un participant aléatoire
            var participants = getParticipants();
            var random = getRandomInt(0, participants.length - 1);
            answer = replaceAll(answer, "dindon-taupe", participants[random]);
            answer = replaceAll(answer, "dindon taupe", participants[random]);
            answer = replaceAll(answer, "dindon", participants[random]);

            // Retient le message auquel le bot va répondre
            that.messageBeforeAnswer = message;

            that.sendMessage(answer);
            cacheMessage(answer);

            // retient l'index de la réponse envoyée et le message
            that.lastAnswerIndex = answerIndex;
            that.lastAnswer = answer;
            console.log("index - 4 : " + messages[answerIndex - 4])
            console.log("index - 3 : " + messages[answerIndex - 3])
            console.log("index - 2 : " + messages[answerIndex - 2])
            console.log("index - 1 : " + messages[answerIndex - 1])
            console.log("index " + answerIndex + " : " + messages[answerIndex]);
        }
    },

    /**
     * Retourne la liste des messages avec leur index et leur score, triés par score
     * dans l'ordre décroissant.
     *
     * @param  {Array.<Object>} indexes
     * @param  {Array.<string>} messages
     * @return {Array.<string>}  Tableau de chaînes correspondantes à un message, son index et son score.
     */
    getSuggestions: function(indexes, messages)
    {
        var that = this;

        indexes.sort(that.compareIndexScore);
        var suggestions = [];

        for (i = 0; i < indexes.length; i++)
        {
            suggestions.push(indexes[i].index + " (" + indexes[i].score + ") : " + messages[indexes[i].index]);
        }

        return suggestions;
    },

    replaceLastAnswer: function(message, commandText)
    {
        var that = this;

        if (that.lastAnswerIndex !== null)
        {
            // Si un message est précédé de la commande -r, la dernière réponse du bot
            // est remplacée par ce message
            cacheMessage(message.replace(commandText, ""), that.lastAnswerIndex)
            cacheMessage(message.replace(commandText, ""), getMessagesFromCache().length - 1)
        }
    },

    addAnswer: function(message, commandText)
    {
        var that = this;

        if (that.messageBeforeAnswer !== null)
        {
            // Ajoute une réponse possible au message auquel le bot a répondu
            cacheMessage(that.messageBeforeAnswer);
            cacheMessage(message.replace(commandText, ""));
        }
    },

    getScore: function(message1, message2, baseScoreWhenEqual, baseScoreWhenWordMatch)
    {
        var that = this;

        message1 = sanitize(message1.replace("'", " "));
        message2 = sanitize(message2.replace("'", " "));

        if (message1 == message2 && message1 == that.lastAnswer)
        {
            return -100000;
        }

        var score = 0;

        if (message1 == message2)
        {
            score += baseScoreWhenEqual;
        }

        var wordMatch = false;
        var wordsMessage1 = message1.split(" ");
        var wordsMessage2 = message2.split(" ");

        for (var i = 0; i < wordsMessage1.length; i++) {
            for (var j = 0; j < wordsMessage2.length; j++) {
                if (wordsMessage1[i] == wordsMessage2[j])
                {
                    wordMatch = true;

                    // Plus le mot est long, plus le score s'élève
                    score += wordsMessage1[i].length;
                }
            };
        };

        if (wordMatch)
        {
            // debugger;
            score += baseScoreWhenWordMatch;
        }

        // La différence du nombre de caractères entres les 2 messages est soustraite
        // au score final
        score -= Math.abs(message1.length - message2.length) / 2;

        return score;
    },

    getIndexesWithBestScore: function(messagesIndexes)
    {
        var max = [];

        for (var i = 0; i < messagesIndexes.length; i++) {
            if (max.length == 0 || max[0].score == messagesIndexes[i].score)
            {
                max.push(messagesIndexes[i]);
            }
            else if (messagesIndexes[i].score > max[0].score)
            {
                max = [messagesIndexes[i]];
            }
        }

        return max;
    },

    compareIndexScore: function(a,b)
    {
        if (a.score < b.score)
            return 1;
        if (a.score > b.score)
            return -1;
        return 0;
    }
}

var bot = new Bot({
    messagePatterns: [
        "Et ta soeur elle fait des {{word}} ??",
        "C'est toi le {{word}}",
        "Osef."
    ],
    repeatLastWord: true,
    randomRepeatLastWord: true,
    repetitionProbability: 1,
    discuss: true,
    // Probabilité en % de réponse aux messages.
    discussionProbability: 35,
    proposeSuggestions: false,
    autoPostMessageAfterInactivity: 43200
});

// On renvoie un entier aléatoire entre une valeur min (incluse)
// et une valeur max (incluse).
// Attention : si on utilisait Math.round(), on aurait une distribution
// non uniforme !
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sauvegarge le message spécifié dans le localStorage.
 * @param  {string} message
 * @param {int} index - spécifie à quel index du tableau le message doit être sauvegardé
 *                        (permet de modifier un message).
 * @return {void}
 */
function cacheMessage(message, index = null)
{
    // debugger;

    // Ne sauvegarde pas les messages de commandes
    if (message.indexOf("--") === 0 || message.indexOf("-r ") === 0 ||
        message.indexOf("-a ") === 0)
    {
        return;
    }

    message = message.replace("@bot ", "");
    message = message.replace("@dindon ", "");
    message = replaceAll(message, "\\n", "");
    message = replaceAll(message, "\\t", "");
    var messages = getMessagesFromCache();

    if (messages == null)
    {
        messages = [];
    }

    if (index === null)
    {
        messages.push(message);
    }
    else
    {
        messages[index] = message;
    }

    localStorage.setItem("messages", JSON.stringify(messages));
    bot.secondsSinceLastMessage = 0;
}

/**
 * Sauvegarde tous les messages visibles de la conversation dans le localStorage.
 * @return {void}
 */
function cacheAllMessages()
{
    jQuery(messagesSelector).each(function(i, e) {
        var message = jQuery(e).text();
        message = replaceAll(message, "\\n", "");
        message = replaceAll(message, "\\t", "");
        cacheMessage(message);
    });
}

/**
 * Retourne les messages de la conversation enregistrés en cache.
 * @return {array} tableau contenant les messages
 */
function getMessagesFromCache()
{
    return JSON.parse(localStorage.getItem("messages"));
}

/**
 * Retoure la liste des participants de la conversation.
 * @return {array} tableau contenant les participants.
 */
function getParticipants()
{
    var participants = [];

    jQuery(participantsSelector).each(function(index, element)
    {
        var participant = jQuery(element).text().trim();

        if (jQuery.inArray(participant, participants) == -1
            && participant.toLowerCase().indexOf("dindon") === -1)
        {
            participants.push(participant);
        }
    });

    return participants;
}

// =================================================
// Suppression des caractères spéciaux
// =================================================

var defaultDiacriticsRemovalMap = [
    {'base':'A', 'letters':'\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F'},
    {'base':'AA','letters':'\uA732'},
    {'base':'AE','letters':'\u00C6\u01FC\u01E2'},
    {'base':'AO','letters':'\uA734'},
    {'base':'AU','letters':'\uA736'},
    {'base':'AV','letters':'\uA738\uA73A'},
    {'base':'AY','letters':'\uA73C'},
    {'base':'B', 'letters':'\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181'},
    {'base':'C', 'letters':'\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E'},
    {'base':'D', 'letters':'\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779'},
    {'base':'DZ','letters':'\u01F1\u01C4'},
    {'base':'Dz','letters':'\u01F2\u01C5'},
    {'base':'E', 'letters':'\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E'},
    {'base':'F', 'letters':'\u0046\u24BB\uFF26\u1E1E\u0191\uA77B'},
    {'base':'G', 'letters':'\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E'},
    {'base':'H', 'letters':'\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D'},
    {'base':'I', 'letters':'\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197'},
    {'base':'J', 'letters':'\u004A\u24BF\uFF2A\u0134\u0248'},
    {'base':'K', 'letters':'\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2'},
    {'base':'L', 'letters':'\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780'},
    {'base':'LJ','letters':'\u01C7'},
    {'base':'Lj','letters':'\u01C8'},
    {'base':'M', 'letters':'\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C'},
    {'base':'N', 'letters':'\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4'},
    {'base':'NJ','letters':'\u01CA'},
    {'base':'Nj','letters':'\u01CB'},
    {'base':'O', 'letters':'\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C'},
    {'base':'OI','letters':'\u01A2'},
    {'base':'OO','letters':'\uA74E'},
    {'base':'OU','letters':'\u0222'},
    {'base':'OE','letters':'\u008C\u0152'},
    {'base':'oe','letters':'\u009C\u0153'},
    {'base':'P', 'letters':'\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754'},
    {'base':'Q', 'letters':'\u0051\u24C6\uFF31\uA756\uA758\u024A'},
    {'base':'R', 'letters':'\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782'},
    {'base':'S', 'letters':'\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784'},
    {'base':'T', 'letters':'\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786'},
    {'base':'TZ','letters':'\uA728'},
    {'base':'U', 'letters':'\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244'},
    {'base':'V', 'letters':'\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245'},
    {'base':'VY','letters':'\uA760'},
    {'base':'W', 'letters':'\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72'},
    {'base':'X', 'letters':'\u0058\u24CD\uFF38\u1E8A\u1E8C'},
    {'base':'Y', 'letters':'\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE'},
    {'base':'Z', 'letters':'\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762'},
    {'base':'a', 'letters':'\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250'},
    {'base':'aa','letters':'\uA733'},
    {'base':'ae','letters':'\u00E6\u01FD\u01E3'},
    {'base':'ao','letters':'\uA735'},
    {'base':'au','letters':'\uA737'},
    {'base':'av','letters':'\uA739\uA73B'},
    {'base':'ay','letters':'\uA73D'},
    {'base':'b', 'letters':'\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253'},
    {'base':'c', 'letters':'\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184'},
    {'base':'d', 'letters':'\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A'},
    {'base':'dz','letters':'\u01F3\u01C6'},
    {'base':'e', 'letters':'\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD'},
    {'base':'f', 'letters':'\u0066\u24D5\uFF46\u1E1F\u0192\uA77C'},
    {'base':'g', 'letters':'\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F'},
    {'base':'h', 'letters':'\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265'},
    {'base':'hv','letters':'\u0195'},
    {'base':'i', 'letters':'\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131'},
    {'base':'j', 'letters':'\u006A\u24D9\uFF4A\u0135\u01F0\u0249'},
    {'base':'k', 'letters':'\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3'},
    {'base':'l', 'letters':'\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747'},
    {'base':'lj','letters':'\u01C9'},
    {'base':'m', 'letters':'\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F'},
    {'base':'n', 'letters':'\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5'},
    {'base':'nj','letters':'\u01CC'},
    {'base':'o', 'letters':'\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275'},
    {'base':'oi','letters':'\u01A3'},
    {'base':'ou','letters':'\u0223'},
    {'base':'oo','letters':'\uA74F'},
    {'base':'p','letters':'\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755'},
    {'base':'q','letters':'\u0071\u24E0\uFF51\u024B\uA757\uA759'},
    {'base':'r','letters':'\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783'},
    {'base':'s','letters':'\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B'},
    {'base':'t','letters':'\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787'},
    {'base':'tz','letters':'\uA729'},
    {'base':'u','letters': '\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289'},
    {'base':'v','letters':'\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C'},
    {'base':'vy','letters':'\uA761'},
    {'base':'w','letters':'\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73'},
    {'base':'x','letters':'\u0078\u24E7\uFF58\u1E8B\u1E8D'},
    {'base':'y','letters':'\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF'},
    {'base':'z','letters':'\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763'}
];

var diacriticsMap = {};
for (var i=0; i < defaultDiacriticsRemovalMap.length; i++){
    var letters = defaultDiacriticsRemovalMap[i].letters;
    for (var j=0; j < letters.length ; j++){
        diacriticsMap[letters[j]] = defaultDiacriticsRemovalMap[i].base;
    }
}

// "what?" version ... http://jsperf.com/diacritics/12
function removeDiacritics (str) {
    return str.replace(/[^\u0000-\u007E]/g, function(a){
       return diacriticsMap[a] || a;
    });
}

function sanitize(str)
{
    str = str.toLowerCase();
    str = replaceAll(str, ",", "");
    str = replaceAll(str, "'", "");
    str = replaceAll(str, ".", " ");
    str = replaceAll(str, "-", " ");
    str = str.replace(/\s\s+/g, " ").trim();
    str = removeDiacritics(str);

    return str;
}

function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function replaceAll(str, find, replace) {
  return str.replace(new RegExp(escapeRegExp(find), 'gi'), replace);
}

function httpGetAsync(theUrl, callback)
{
    var xmlHttp = new XMLHttpRequest();

    xmlHttp.onreadystatechange = function()
    {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
        {
            callback(xmlHttp.responseText);
        }
    }

    xmlHttp.open("GET", theUrl, true); // true for asynchronous
    xmlHttp.send(null);
}

jQuery(document).ready(function()
{
    setTimeout(function()
    {
        // Ouvre la liste des participants de la conversation
        jQuery("#channel_members_toggle_count").click();

        bot.start();
    }, 90000);
});

// Nettoyage de la base de messages
var pattern = /^\s{4,}(.+)\s{4,}/i; // ex : "      drop the mic        /giphy      "
var regex = new RegExp(pattern);
pattern = /^([^\s]+)\s{4,}/i; // liens - ex : "http://www.google.fr         description"

var msgs = getMessagesFromCache();
var indexesToRemove = [];

getMessagesFromCache().forEach(function(el, i)
{
    if (el == null)
    {
        indexesToRemove.push(i);
        return;
    }

    if (regex.test(el))
    {
        // Supprime le message trouvé
        indexesToRemove.push(i);
        return;
    }

    var matches = el.match(pattern);

    if (matches != null && matches[1] != null)
    {
        // Ne garde que le lien
        msgs[i] = matches[1];
    }
});

/**
 * Supprime les éléments d'un tableau aux index spécifiés.
 */
function removeElements(indexes, array)
{
    for (var i = indexes.length -1; i >= 0; i--)
    {
       array.splice(indexes[i], 1);
    }
}

removeElements(indexesToRemove, msgs);
localStorage.messages = JSON.stringify(msgs);

// =================================================
// =================================================

// var messages = [];
// var elements = document.getElementsByClassName("aOT");
// Array.prototype.forEach.call(elements, function(el) {
//   messages.push(el.innerText);
// });
// JSON.stringify(messages);

// messages = JSON.parse('');
// localStorage.messages = JSON.stringify(messages);
