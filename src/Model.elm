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
    }



--initialModel : Model
--initialModel =
--    { step = 19
--    , topic = "Pizza"
--    , initiator = Person Initiator "Eric" Male (initiatorSideOfConversation)
--    , partner = Person Partner "Jenna" Female (partnerSideOfConversation)
--    }
--
--
--initiatorSideOfConversation : SideOfConversation
--initiatorSideOfConversation =
--    { stance = "It's good"
--    , reason1 = "Warm"
--    , reason2 = "Tomaotes"
--    , reason3 = "Sausage"
--    , empathy1 = "Pepperoni is her favorite flavor, and diluting it even a little is an insult"
--    , empathy2 = "She ate a soggy pizza and got sick when she was a kid"
--    , empathy3 = "Life can feel boring if you're doing what everyone else is doing"
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
--    }
