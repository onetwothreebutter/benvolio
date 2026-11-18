module Model exposing (..)


type alias Model =
    { firebaseKey : String
    , step : Int
    , topic : String
    , initiator : Person
    , partner : Person
    }


type alias Person =
    { role : ConversationRole
    , name : String
    , gender : Gender
    , sideOfConversation : SideOfConversation
    }


type alias SideOfConversation =
    { stance : String
    , reason1 : String
    , reason2 : String
    , reason3 : String
    , empathy1 : String
    , empathy2 : String
    , empathy3 : String
    , question1 : String
    , question2 : String
    , question3 : String
    , answer1 : String
    , answer2 : String
    , answer3 : String
    }


type Gender
    = Male
    | Female
    | Trans


type ConversationRole
    = Initiator
    | Partner


initialModel : Model
initialModel =
    { firebaseKey = ""
    , step = 1
    , topic = ""
    , initiator = Person Initiator "" Male (initiatorSideOfConversation)
    , partner = Person Partner "" Male (partnerSideOfConversation)
    }


initiatorSideOfConversation : SideOfConversation
initiatorSideOfConversation =
    { stance = ""
    , reason1 = ""
    , reason2 = ""
    , reason3 = ""
    , empathy1 = ""
    , empathy2 = ""
    , empathy3 = ""
    , question1 = ""
    , question2 = ""
    , question3 = ""
    , answer1 = ""
    , answer2 = ""
    , answer3 = ""
    }


partnerSideOfConversation : SideOfConversation
partnerSideOfConversation =
    { stance = ""
    , reason1 = ""
    , reason2 = ""
    , reason3 = ""
    , empathy1 = ""
    , empathy2 = ""
    , empathy3 = ""
    , question1 = ""
    , question2 = ""
    , question3 = ""
    , answer1 = ""
    , answer2 = ""
    , answer3 = ""
    }



--initialModel : Model
--initialModel =
--    { firebaseKey = ""
--    , step = 6
--    , topic = "Pizza"
--    , initiator = Person Initiator "Eric" Male (initiatorSideOfConversation)
--    , partner = Person Partner "Jenna" Female (partnerSideOfConversation)
--    }
--
--
--initiatorSideOfConversation : SideOfConversation
--initiatorSideOfConversation =
--    { stance = "Sausage and tomato pizza is the best"
--    , reason1 = "Warm food is delicious"
--    , reason2 = "Tomaotes on a pizza taste soo good"
--    , reason3 = "Sausage is my favorite meat"
--    , empathy1 = "Pepperoni is her favorite flavor, and diluting it even a little is an insult"
--    , empathy2 = "She ate a soggy pizza and got sick when she was a kid"
--    , empathy3 = "Life can feel boring if you're doing what everyone else is doing"
--    , question1 = "Did you know tomatoes are a fruit?"
--    , question2 = "Are there other mainstream things that you like?"
--    , question3 = "Have you tried pizzas cooked with pizza stones?"
--    , answer1 = "No, that sounds gross!"
--    , answer2 = "No, I'm curious what tomatoes by themselves taste like"
--    , answer3 = "Hamburger"
--    }
--
--
--partnerSideOfConversation : SideOfConversation
--partnerSideOfConversation =
--    { stance = "Pizza sucks"
--    , reason1 = "Not enough possible pepperoni"
--    , reason2 = "The crust is always soggy"
--    , reason3 = "It's too mainstream"
--    , empathy1 = "Eric prefers warm food to cold food"
--    , empathy2 = "His favorite vegatable are tomatoes, which are a main ingredient on pizzas"
--    , empathy3 = "His favorite meat is sausage, which is a great pizza topping"
--    , question1 = "Have you tried cold pizza for breakfast?"
--    , question2 = "Have you tried a pizza with just tomatoes and no oregano?"
--    , question3 = "What's your second favorite pizza meat?"
--    , answer1 = "I do know that, but it doesn't seem to matter for this conversation"
--    , answer2 = "I like clothes"
--    , answer3 = "No, I've heard of pizza stones, but haven't used them"
--    }
