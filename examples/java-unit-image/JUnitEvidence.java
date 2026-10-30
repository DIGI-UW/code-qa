import java.nio.file.*;
import java.util.*;
import javax.xml.parsers.*;
import javax.xml.transform.*;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import org.junit.runner.*;
import org.junit.runner.notification.*;
import org.w3c.dom.*;

/** Records the existing JUnit tests; it adds no replacement assertions. */
public class JUnitEvidence {
  public static void main(String[] args) throws Exception {
    Document doc = DocumentBuilderFactory.newInstance().newDocumentBuilder().newDocument();
    Element suite = doc.createElement("testsuite"); doc.appendChild(suite);
    Map<Description,Element> cases = new LinkedHashMap<>();
    JUnitCore runner = new JUnitCore();
    runner.addListener(new RunListener() {
      public void testStarted(Description d) {
        Element c=doc.createElement("testcase");c.setAttribute("classname",d.getClassName());c.setAttribute("name",d.getMethodName());suite.appendChild(c);cases.put(d,c);
      }
      public void testFailure(Failure f) {
        Element c=cases.get(f.getDescription());
        if(c==null){testStarted(f.getDescription());c=cases.get(f.getDescription());}
        Element e=doc.createElement(f.getException() instanceof AssertionError ? "failure":"error");
        e.setAttribute("message",String.valueOf(f.getMessage()));e.setTextContent(f.getTrace());c.appendChild(e);
      }
    });
    org.junit.runner.Result result=runner.run(Class.forName(args[0]));
    TransformerFactory.newInstance().newTransformer().transform(new DOMSource(doc),new StreamResult(args[1]));
    System.exit(result.wasSuccessful()?0:1);
  }
}
