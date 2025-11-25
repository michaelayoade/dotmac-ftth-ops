# Page snapshot

```yaml
- generic [ref=e2]:
  - link "Skip to main content" [ref=e3] [cursor=pointer]:
    - /url: "#main-content"
  - main [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - link "← Back to home" [ref=e7] [cursor=pointer]:
          - /url: /
        - generic [ref=e9]: 🌐
        - heading "Network Operations Portal" [level=1] [ref=e10]
        - paragraph [ref=e11]: Access your DotMac management dashboard
        - paragraph [ref=e12]: Manage subscribers, network, billing, and operations
      - generic [ref=e13]:
        - generic [ref=e14]:
          - generic [ref=e15]: Username or Email
          - textbox "Username or Email" [ref=e16]:
            - /placeholder: username or email
        - generic [ref=e17]:
          - generic [ref=e18]: Password
          - textbox "Password" [ref=e19]:
            - /placeholder: ••••••••
        - generic [ref=e20]:
          - generic [ref=e21]:
            - checkbox "Remember me" [ref=e22]
            - generic [ref=e23]: Remember me
          - link "Forgot password?" [ref=e24] [cursor=pointer]:
            - /url: /forgot-password
        - button "Sign in" [ref=e25] [cursor=pointer]
        - button "Test Login Admin" [ref=e26] [cursor=pointer]
  - status [ref=e27]
  - alert [ref=e28]
```