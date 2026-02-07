describe("Auth flow", () => {
  it("signs up and logs in", () => {
    const email = `user_${Date.now()}@example.com`;
    const password = "Password123";

    cy.visit("/signup");
    cy.contains("Create your workspace");
    cy.get("input[name='name']").type("Cypress User");
    cy.get("input[name='email']").type(email);
    cy.get("input[name='password']").type(password);
    cy.contains("Create account").click();

    cy.contains("Redirecting");
    cy.visit("/login");

    cy.get("input[name='email']").type(email);
    cy.get("input[name='password']").type(password);
    cy.contains("Sign in").click();

    cy.url().should("include", "/dashboard");
  });
});
