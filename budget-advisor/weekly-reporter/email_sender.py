"""
Email sender module for Budget Advisor Weekly Reporter.
Sends weekly expense analysis reports via email using SMTP.
"""

import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


class EmailSender:
    """Email sender using SMTP"""

    def __init__(
        self,
        smtp_host: str,
        smtp_port: int,
        smtp_user: str,
        smtp_password: str,
        from_email: str,
        use_tls: bool = True
    ):
        """
        Initialize email sender.

        Args:
            smtp_host: SMTP server hostname (e.g., 'smtp.gmail.com')
            smtp_port: SMTP server port (e.g., 587 for TLS, 465 for SSL)
            smtp_user: SMTP username for authentication
            smtp_password: SMTP password or app-specific password
            from_email: Email address to send from
            use_tls: Whether to use TLS (default: True)
        """
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
        self.from_email = from_email
        self.use_tls = use_tls

    def send_report(
        self,
        to_email: str,
        subject: str,
        analysis: str,
        week_info: Optional[str] = None
    ) -> bool:
        """
        Send weekly expense report via email.

        Args:
            to_email: Recipient email address(es). Can be:
                     - Single email: "user@example.com"
                     - Multiple emails: "user1@example.com, user2@example.com"
                     - Semicolon-separated: "user1@example.com; user2@example.com"
            subject: Email subject
            analysis: Analysis text from advisor agent
            week_info: Optional week information to include

        Returns:
            True if email sent successfully, False otherwise
        """
        try:
            # Parse multiple email addresses
            # Support both comma and semicolon separated
            recipients = self._parse_email_addresses(to_email)

            if not recipients:
                logger.error("No valid email addresses provided")
                return False

            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.from_email
            msg['To'] = ', '.join(recipients)  # Display all recipients in To field
            msg['Date'] = datetime.now().strftime('%a, %d %b %Y %H:%M:%S %z')

            # Create body
            text_body = self._create_text_body(analysis, week_info)
            html_body = self._create_html_body(analysis, week_info)

            # Attach both plain text and HTML versions
            part1 = MIMEText(text_body, 'plain')
            part2 = MIMEText(html_body, 'html')
            msg.attach(part1)
            msg.attach(part2)

            # Send email
            if len(recipients) == 1:
                logger.info(f"Sending email to {recipients[0]}...")
            else:
                logger.info(f"Sending email to {len(recipients)} recipients: {', '.join(recipients)}")

            if self.use_tls:
                # TLS connection (port 587)
                with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                    server.starttls()
                    server.login(self.smtp_user, self.smtp_password)
                    server.send_message(msg)
            else:
                # SSL connection (port 465)
                with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port) as server:
                    server.login(self.smtp_user, self.smtp_password)
                    server.send_message(msg)

            if len(recipients) == 1:
                logger.info(f"✓ Email sent successfully to {recipients[0]}")
            else:
                logger.info(f"✓ Email sent successfully to {len(recipients)} recipients")
            return True

        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False

    def _parse_email_addresses(self, email_string: str) -> list[str]:
        """
        Parse email addresses from a string.
        Supports comma-separated and semicolon-separated formats.

        Args:
            email_string: Email address(es) as string

        Returns:
            List of email addresses
        """
        import re

        # Split by comma or semicolon
        emails = re.split(r'[,;]', email_string)

        # Clean up whitespace and filter empty strings
        emails = [email.strip() for email in emails if email.strip()]

        # Basic validation - check for @ symbol
        valid_emails = []
        for email in emails:
            if '@' in email and '.' in email:
                valid_emails.append(email)
            else:
                logger.warning(f"Skipping invalid email address: {email}")

        return valid_emails

    def _create_text_body(self, analysis: str, week_info: Optional[str] = None) -> str:
        """Create plain text email body"""
        body = "Budget Advisor - Weekly Expense Report\n"
        body += "=" * 50 + "\n\n"

        if week_info:
            body += f"{week_info}\n\n"

        body += analysis + "\n\n"
        body += "=" * 50 + "\n"
        body += f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"

        return body

    def _markdown_to_html(self, text: str) -> str:
        """
        Convert common markdown formatting to HTML.
        Handles: **bold**, *italic*, numbered lists, bullet lists, headers, tables
        """
        import re

        # Escape HTML characters first
        text = text.replace('&', '&amp;')
        text = text.replace('<', '&lt;')
        text = text.replace('>', '&gt;')

        # Remove orphaned trailing asterisks (not paired for italic/bold)
        text = re.sub(r'\*(\s*)$', r'\1', text, flags=re.MULTILINE)

        # Convert markdown tables to HTML tables
        text = self._convert_tables(text)

        # Convert headers (# Header, ## Header, etc.)
        text = re.sub(r'^### (.+)$', r'<h3>\1</h3>', text, flags=re.MULTILINE)
        text = re.sub(r'^## (.+)$', r'<h2>\1</h2>', text, flags=re.MULTILINE)
        text = re.sub(r'^# (.+)$', r'<h1>\1</h1>', text, flags=re.MULTILINE)

        # Convert **bold** to <strong>
        text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)

        # Convert *italic* to <em> (only matched pairs)
        text = re.sub(r'\*([^\*\n]+?)\*', r'<em>\1</em>', text)

        # Convert bullet lists (- item or * item) and numbered lists
        lines = text.split('\n')
        in_list = False
        list_type = None  # Track whether we're in 'ul' or 'ol'
        result_lines = []

        for i, line in enumerate(lines):
            stripped = line.strip()

            # Skip completely empty lines inside lists
            if not stripped and in_list:
                continue

            # Check if line is a bullet point (including indented)
            if re.match(r'^\s*[\-\*]\s+', line):
                if not in_list or list_type != 'ul':
                    # Close previous list if different type
                    if in_list and list_type == 'ol':
                        result_lines.append('</ol>')
                    if not in_list or list_type != 'ul':
                        result_lines.append('<ul>')
                        in_list = True
                        list_type = 'ul'
                # Remove the bullet marker and wrap in <li>
                item = re.sub(r'^\s*[\-\*]\s+', '', line)
                result_lines.append(f'  <li>{item}</li>')
            # Check if line is a numbered list
            elif re.match(r'^\d+\.\s+', line):
                if not in_list or list_type != 'ol':
                    # Close previous list if different type
                    if in_list and list_type == 'ul':
                        result_lines.append('</ul>')
                    if not in_list or list_type != 'ol':
                        result_lines.append('<ol>')
                        in_list = True
                        list_type = 'ol'
                # Remove the number and wrap in <li>
                item = re.sub(r'^\d+\.\s+', '', line)
                result_lines.append(f'  <li>{item}</li>')
            else:
                # Not a list item
                if in_list:
                    result_lines.append(f'</{list_type}>')
                    in_list = False
                    list_type = None
                # Only add non-empty lines or lines between content
                if stripped or (result_lines and not result_lines[-1].startswith('</')):
                    result_lines.append(line)

        # Close any open list
        if in_list:
            result_lines.append(f'</{list_type}>')

        text = '\n'.join(result_lines)

        # Convert double newlines to paragraph breaks
        text = re.sub(r'\n\n+', '</p><p>', text)
        text = f'<p>{text}</p>'

        # Convert remaining single newlines to <br>
        text = text.replace('\n', '<br>\n')

        # Clean up empty paragraphs and extra breaks
        text = re.sub(r'<p>\s*</p>', '', text)
        text = re.sub(r'<p>\s*<br>\s*</p>', '', text)

        # Remove ALL breaks around block-level elements (tables, lists, etc.)
        # This is more aggressive but ensures clean HTML
        block_tags = ['ul', 'ol', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'li', 'h1', 'h2', 'h3']
        for tag in block_tags:
            # Remove <br> before opening tags
            text = re.sub(rf'<br>\s*<{tag}[>\s]', rf'<{tag}>', text)
            text = re.sub(rf'<br>\s*<{tag}>', rf'<{tag}>', text)
            # Remove <br> after closing tags
            text = re.sub(rf'</{tag}>\s*<br>', rf'</{tag}>', text)

        # Remove <br> after any closing tag followed by whitespace and another tag
        text = re.sub(r'(<[^>]+>)\s*<br>\s*\n\s*(<[^>]+>)', r'\1\n\2', text)

        # Remove excessive whitespace and breaks
        text = re.sub(r'(<br>\s*){2,}', '<br>', text)  # Multiple consecutive <br> to single

        return text

    def _convert_tables(self, text: str) -> str:
        """
        Convert markdown tables to HTML tables.

        Example markdown table:
        | Header 1 | Header 2 |
        |----------|----------|
        | Cell 1   | Cell 2   |
        """
        import re

        lines = text.split('\n')
        result_lines = []
        in_table = False
        table_rows = []

        for i, line in enumerate(lines):
            # Check if this line looks like a table row (contains pipes)
            if '|' in line and line.strip().startswith('|'):
                # Check if next line is a separator (|----|)
                is_header = False
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    if re.match(r'^\|[\s\-\|:]+\|$', next_line):
                        is_header = True

                if not in_table:
                    # Start a new table
                    in_table = True
                    table_rows = []
                    result_lines.append('<table>')

                # Parse the row
                cells = [cell.strip() for cell in line.split('|')[1:-1]]  # Remove first/last empty

                if is_header:
                    # This is a header row
                    result_lines.append('  <thead>')
                    result_lines.append('    <tr>')
                    for cell in cells:
                        result_lines.append(f'      <th>{cell}</th>')
                    result_lines.append('    </tr>')
                    result_lines.append('  </thead>')
                    result_lines.append('  <tbody>')
                elif re.match(r'^[\s\-\|:]+$', line.strip()):
                    # This is a separator line, skip it
                    continue
                else:
                    # This is a data row
                    result_lines.append('    <tr>')
                    for cell in cells:
                        result_lines.append(f'      <td>{cell}</td>')
                    result_lines.append('    </tr>')
            else:
                # Not a table row
                if in_table:
                    # Close the table
                    result_lines.append('  </tbody>')
                    result_lines.append('</table>')
                    in_table = False
                result_lines.append(line)

        # Close table if still open
        if in_table:
            result_lines.append('  </tbody>')
            result_lines.append('</table>')

        return '\n'.join(result_lines)

    def _create_html_body(self, analysis: str, week_info: Optional[str] = None) -> str:
        """Create HTML email body"""
        # Convert markdown analysis to HTML with proper formatting
        analysis_html = self._markdown_to_html(analysis)

        html = f"""
        <html>
          <head>
            <style>
              body {{
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
              }}
              .header {{
                background-color: #4CAF50;
                color: white;
                padding: 20px;
                text-align: center;
              }}
              .content {{
                padding: 20px;
                background-color: #f9f9f9;
              }}
              .week-info {{
                background-color: #e8f5e9;
                padding: 10px;
                margin-bottom: 20px;
                border-left: 4px solid #4CAF50;
              }}
              .analysis {{
                background-color: white;
                padding: 20px;
                border-radius: 5px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }}
              .analysis h1 {{
                color: #2E7D32;
                font-size: 24px;
                margin-top: 20px;
                margin-bottom: 10px;
              }}
              .analysis h2 {{
                color: #388E3C;
                font-size: 20px;
                margin-top: 15px;
                margin-bottom: 8px;
              }}
              .analysis h3 {{
                color: #43A047;
                font-size: 18px;
                margin-top: 12px;
                margin-bottom: 6px;
              }}
              .analysis ul, .analysis ol {{
                margin: 10px 0;
                padding-left: 25px;
              }}
              .analysis li {{
                margin: 5px 0;
              }}
              .analysis strong {{
                color: #1B5E20;
                font-weight: 600;
              }}
              .analysis p {{
                margin: 10px 0;
              }}
              .analysis table {{
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
                background-color: white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              }}
              .analysis table th {{
                background-color: #4CAF50;
                color: white;
                padding: 12px;
                text-align: left;
                font-weight: 600;
                border: 1px solid #45a049;
              }}
              .analysis table td {{
                padding: 10px 12px;
                border: 1px solid #ddd;
                color: #333;
              }}
              .analysis table tr:nth-child(even) {{
                background-color: #f9f9f9;
              }}
              .analysis table tr:hover {{
                background-color: #f1f1f1;
              }}
              .footer {{
                text-align: center;
                padding: 10px;
                font-size: 12px;
                color: #777;
              }}
            </style>
          </head>
          <body>
            <div class="header">
              <h1>📊 Budget Advisor</h1>
              <p>Weekly Expense Report</p>
            </div>
            <div class="content">
        """

        if week_info:
            html += f'<div class="week-info">{week_info}</div>'

        html += f"""
              <div class="analysis">
                {analysis_html}
              </div>
            </div>
            <div class="footer">
              Generated on {datetime.now().strftime('%Y-%m-%d at %H:%M:%S')}
            </div>
          </body>
        </html>
        """

        return html


def create_email_sender_from_env() -> EmailSender:
    """
    Create EmailSender instance from environment variables.

    Required environment variables:
        SMTP_HOST: SMTP server hostname
        SMTP_PORT: SMTP server port
        SMTP_USER: SMTP username
        SMTP_PASSWORD: SMTP password
        FROM_EMAIL: Sender email address
        SMTP_USE_TLS: Whether to use TLS (default: true)

    Returns:
        Configured EmailSender instance
    """
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("FROM_EMAIL")
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    if not all([smtp_host, smtp_user, smtp_password, from_email]):
        raise ValueError(
            "Missing required email configuration. Please set: "
            "SMTP_HOST, SMTP_USER, SMTP_PASSWORD, FROM_EMAIL"
        )

    return EmailSender(
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        smtp_user=smtp_user,
        smtp_password=smtp_password,
        from_email=from_email,
        use_tls=use_tls
    )
