import { renderTemplate, extractSmartFirstName } from "../lib/template-renderer";

const leads = [
  { first_name: "Food Cloud", email: "jimjaaj@gmail.com" },
  { first_name: null, full_name: "Urban Bistro Restaurant", email: "jimjayedalafroz@gmail.com" },
  { first_name: "", full_name: "", email: "rakib123@gmail.com" },
  { first_name: "Tanzil", email: "tanzil.rahman@outlook.com" }
];

const templateSubject = "Quick Idea for {{Company Name}} - {{First Name}}";
const templateBody = "Hi {{First Name}},\n\nSaw {{name}} and wanted to connect with {{Company}}.\n\nBest,\n{{Sender Name}}";

for (const lead of leads) {
  const smartFirstName = extractSmartFirstName(lead.first_name, lead.full_name, lead.email);
  const variables = {
    first_name: smartFirstName,
    last_name: "",
    full_name: smartFirstName,
    company_name: lead.first_name || lead.full_name || "your company",
    job_title: "",
    website: "",
    booking_link: "https://booking.com",
    sender_name: "Jayed Al Afroz Jim",
    sender_email: "veltrixaisolutions1@gmail.com",
  };

  const renderedSubject = renderTemplate(templateSubject, variables);
  const renderedBody = renderTemplate(templateBody, variables);

  console.log("=== LEAD:", lead.email, "===");
  console.log("Smart First Name:", smartFirstName);
  console.log("Subject:", renderedSubject);
  console.log("Body:\n" + renderedBody);
}

