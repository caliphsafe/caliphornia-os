# Caliphornia OS Launch QA Checklist

This checklist must be completed before public launch.

## QA test accounts

Use these accounts to test each access state:

| Account | Purpose |
|---|---|
| free@caliphqa.local | Free listener |
| friendsonly@caliphqa.local | Owns Fri.ends only |
| miliaonly@caliphqa.local | Owns Milia only |
| fartherhoodonly@caliphqa.local | Owns FarTHErHOOD only |
| pass30@caliphqa.local | Has 30-day Kiiku Pass |
| monthly@caliphqa.local | Has monthly Kiiku Pass |
| adminqa@caliphqa.local | Admin account |

## Global launch checks

For every account, test:

- [ ] User can sign in
- [ ] Home screen loads
- [ ] Username/account chip opens Account page
- [ ] Account page loads with correct email
- [ ] Access Window opens
- [ ] Access Window closes
- [ ] Access Window app links work
- [ ] Calendar opens
- [ ] Calendar dots show on release dates
- [ ] Tapping a dotted date opens release details
- [ ] Release detail button links to the correct app
- [ ] No broken icons
- [ ] No horizontal mobile overflow
- [ ] No Vercel runtime errors

## Free user test

Account:

```txt
free@caliphqa.local
